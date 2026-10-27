/*
 * O estado das conversas com o bot, compartilhado entre a página e a barra
 * lateral (que, na página de conversas, vira a lista de conversas).
 *
 * - A lista é carregada uma vez e atualizada no lugar: uma pergunta nova põe
 *   a conversa no topo, o título que o servidor gera entra quando chega.
 * - A conversa aberta guarda as mensagens e a resposta em andamento; trocar
 *   de página no meio de uma resposta não a interrompe — o texto continua
 *   chegando e é gravado no servidor de qualquer jeito.
 */
import app from 'flarum/forum/app';

import { aiInfo, aiStream, showAiError, type StreamLine } from '../state';
import type { ToolActivity } from '../ui';
import { deleteConversation, fetchConversation, fetchConversations, renameConversation } from './api';

export interface AiConversation {
  id: string;
  title: string | null;
  persona: string | null;
  messageCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools: ToolActivity[];
  model: string | null;
  createdAt: string | null;
  /** Ainda chegando (a resposta em streaming). */
  streaming?: boolean;
}

class ConversationsState {
  conversations: AiConversation[] = [];
  loaded = false;
  loading = false;
  hasMore = false;

  /** A conversa aberta (null na tela de "Nova pergunta"). */
  currentId: string | null = null;
  messages: AiMessage[] = [];
  loadingMessages = false;
  missing = false;

  /** A resposta em andamento: a conversa a que pertence e o cancelamento. */
  sending = false;
  sendingFor: string | null = null;
  controller: AbortController | null = null;

  /** O que a página pediu para mandar assim que abrir (o "Perguntar à IA" da busca). */
  pendingQuestion: string | null = null;

  /** A pergunta que não chegou ao servidor (erro), de volta para o campo. */
  restoreQuestion: string | null = null;

  persona: string | null = null;

  loadList(more = false): void {
    if (this.loading || (this.loaded && !more)) return;

    this.loading = true;

    fetchConversations(more ? this.conversations.length : 0)
      .then((response) => {
        this.conversations = more ? [...this.conversations, ...response.data] : response.data;
        this.hasMore = response.hasMore;
        this.loaded = true;
      })
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  open(id: string | null): void {
    if (this.currentId === id && (id === null || this.messages.length || this.loadingMessages)) return;

    this.currentId = id;
    this.missing = false;

    // A resposta em andamento é desta conversa: as mensagens já estão aqui.
    if (id !== null && this.sendingFor === id) return;

    this.messages = [];

    if (id === null) return;

    this.loadingMessages = true;

    fetchConversation(id)
      .then((response) => {
        if (this.currentId !== id) return;

        this.messages = response.messages;
        this.upsert(response.conversation, false);
      })
      .catch(() => {
        if (this.currentId === id) this.missing = true;
      })
      .finally(() => {
        this.loadingMessages = false;
        m.redraw();
      });
  }

  current(): AiConversation | null {
    return this.conversations.find((conversation) => conversation.id === this.currentId) ?? null;
  }

  personaFor(conversation: AiConversation | null): string | null {
    return conversation?.persona ?? this.persona ?? aiInfo()?.defaultPersona ?? null;
  }

  async send(question: string): Promise<void> {
    const text = question.trim();

    if (!text || this.sending) return;

    const conversationId = this.currentId;
    const placeholder: AiMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      tools: [],
      model: null,
      createdAt: new Date().toISOString(),
    };
    const reply: AiMessage = { id: `reply-${Date.now()}`, role: 'assistant', content: '', tools: [], model: null, createdAt: null, streaming: true };

    this.messages = [...this.messages, placeholder, reply];
    this.sending = true;
    this.sendingFor = conversationId;
    this.controller = new AbortController();
    m.redraw();

    try {
      await aiStream(
        'conversations/reply',
        { conversationId: conversationId ? Number(conversationId) : null, message: text, persona: this.personaFor(null) },
        (line) => this.handleLine(line, placeholder, reply),
        this.controller.signal
      );
    } catch (error) {
      showAiError(error);

      // Nada chegou ao servidor: a pergunta volta para o campo.
      if (!reply.content && this.messages.includes(reply)) {
        this.messages = this.messages.filter((message) => message !== placeholder && message !== reply);
        this.restoreQuestion = text;
      }
    } finally {
      reply.streaming = false;
      this.sending = false;
      this.sendingFor = null;
      this.controller = null;
      this.refreshRemaining();
      m.redraw();
    }
  }

  stop(): void {
    this.controller?.abort();
  }

  rename(conversation: AiConversation, title: string): Promise<void> {
    return renameConversation(conversation.id, title).then((updated) => {
      this.upsert(updated, false);
      m.redraw();
    });
  }

  remove(conversation: AiConversation): Promise<void> {
    return deleteConversation(conversation.id).then(() => {
      this.conversations = this.conversations.filter((item) => item.id !== conversation.id);

      if (this.currentId === conversation.id) m.route.set(app.route('canela.ai.conversations'));

      m.redraw();
    });
  }

  private handleLine(line: StreamLine, placeholder: AiMessage, reply: AiMessage): void {
    switch (line.type) {
      case 'conversation': {
        const conversation = line.conversation as AiConversation;

        Object.assign(placeholder, line.userMessage);
        this.upsert(conversation, true);
        this.sendingFor = conversation.id;

        // Na "Nova pergunta" a URL passa a ser a da conversa, sem recriar a
        // página (a resposta já está chegando nela).
        if (line.isNew && this.currentId === null) {
          this.currentId = conversation.id;
          window.history.replaceState(window.history.state, '', app.route('canela.ai.conversation', { id: conversation.id }));
        }
        break;
      }

      case 'delta':
        reply.content += String(line.text || '');
        break;

      case 'tool':
        reply.tools = [...reply.tools, line.activity as ToolActivity];
        break;

      case 'message':
        Object.assign(reply, line.message, { streaming: true });
        break;

      case 'title': {
        const conversation = this.conversations.find((item) => item.id === String(line.conversationId));

        if (conversation) conversation.title = line.title;
        if (this.currentId === String(line.conversationId)) app.setTitle(line.title);
        break;
      }

      case 'error':
        app.alerts.show({ type: 'error' }, line.message);
        break;
    }

    m.redraw();
  }

  private upsert(conversation: AiConversation, toTop: boolean): void {
    const index = this.conversations.findIndex((item) => item.id === conversation.id);

    if (index === -1) {
      this.conversations = [conversation, ...this.conversations];
    } else if (toTop) {
      this.conversations = [conversation, ...this.conversations.filter((item) => item.id !== conversation.id)];
    } else {
      this.conversations[index] = { ...this.conversations[index], ...conversation };
    }
  }

  /** O limite diário mostrado no fórum desce a cada pergunta. */
  private refreshRemaining(): void {
    const info = aiInfo();

    if (info && typeof info.remaining === 'number') info.remaining = Math.max(0, info.remaining - 1);
  }
}

export const conversations = new ConversationsState();
