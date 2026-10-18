/*
 * A página de conversas com o bot de IA do Discourse
 * (`/discourse-ai/ai-bot/conversations`, aqui `/ai/conversations`).
 *
 * - Sem conversa aberta: o "Como posso ajudar?" no meio da tela, o campo
 *   grande "Faça uma pergunta…", o seletor de persona embaixo e o aviso de
 *   que a IA pode errar.
 * - Com conversa: as mensagens como posts (a pessoa e o bot, com a persona e
 *   o modelo), a resposta chegando em streaming, e o campo encaixado no pé da
 *   página, como o "docked composer" do Discourse.
 *
 * A lista de conversas mora na barra lateral global (./sidebar.tsx), que
 * nesta página troca de conteúdo, como a do Discourse.
 */
import app from 'flarum/forum/app';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import { aiInfo, aiUsable } from '../state';
import Cooked from '../Cooked';
import { indicatorWave, toolDetails } from '../ui';
import { conversations, type AiMessage } from './ConversationsState';

// As rotas e o askAi moram em ./routes, fora do chunk desta página.
import { CONVERSATIONS_ROUTE, CONVERSATION_ROUTE } from './routes';

const INPUT_ID = 'ai-bot-conversations-input';

export default class ConversationsPage extends Page<IPageAttrs> {
  input = '';
  textarea: HTMLTextAreaElement | null = null;
  /** Rolar até o fim a cada pedaço só enquanto a pessoa já está no fim. */
  stickToBottom = true;
  scrollListener = () => this.onScroll();

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>) {
    super.oninit(vnode);

    this.bodyClass = 'App--canelaAi ai-bot-conversations-page';

    if (!aiUsable('bot')) return;

    const id = m.route.param('id') ? String(m.route.param('id')) : null;

    conversations.loadList();

    conversations.open(id);

    // A pergunta do "Perguntar à IA" da busca vai direto, numa conversa nova.
    if (conversations.pendingQuestion && !id) {
      const question = conversations.pendingQuestion;
      conversations.pendingQuestion = null;
      setTimeout(() => conversations.send(question), 0);
    }

    app.history.push(id ? CONVERSATION_ROUTE : CONVERSATIONS_ROUTE, t('ai.bot.page_title'));
    app.setTitle(conversations.current()?.title || t('ai.bot.page_title'));
    app.setTitleCount(0);
  }

  oncreate(vnode: Mithril.VnodeDOM<IPageAttrs, this>) {
    super.oncreate(vnode);
    window.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  onremove(vnode: Mithril.VnodeDOM<IPageAttrs, this>) {
    super.onremove(vnode);
    window.removeEventListener('scroll', this.scrollListener);
  }

  onupdate(vnode: Mithril.VnodeDOM<IPageAttrs, this>) {
    super.onupdate(vnode);

    if (conversations.sending && this.stickToBottom && conversations.currentId) {
      window.scrollTo({ top: document.documentElement.scrollHeight });
    }
  }

  view() {
    if (!aiUsable('bot')) {
      return (
        <PageStructure className="CanelaAiPage">
          <p className="CanelaAi-empty">{app.session.user ? t('ai.bot.not_allowed') : t('ai.bot.log_in')}</p>
        </PageStructure>
      );
    }

    const isNew = conversations.currentId === null;

    return (
      <PageStructure className={classList('CanelaAiPage', { 'CanelaAiPage--new': isNew })}>
        {isNew ? this.newConversationView() : this.conversationView()}
      </PageStructure>
    );
  }

  // ── Nova pergunta ─────────────────────────────────────────────────────────

  newConversationView(): Mithril.Children {
    return (
      <div className="ai-bot-conversations CanelaAiConversations">
        <div className="ai-bot-conversations__content-wrapper">
          <div className="ai-bot-conversations__title">
            <Icon name="fas fa-robot" />
            {t('ai.bot.header')}
          </div>
          <div className="ai-bot-conversations__input-container">
            {this.inputView(false)}
            {this.personaSelector()}
          </div>
          <p className="ai-disclaimer">{t('ai.bot.disclaimer')}</p>
          {this.remainingView()}
        </div>
      </div>
    );
  }

  personaSelector(): Mithril.Children {
    const personas = aiInfo()?.personas || [];

    if (personas.length < 2) return null;

    const current = conversations.personaFor(null);

    return (
      <div className="agent-llm-selector">
        <div className="agent-llm-selector__selection-wrapper">
          <label for="canela-ai-persona">{t('ai.bot.persona_label')}</label>
          <span className="CanelaAi-selectWrap">
            <select
              id="canela-ai-persona"
              className="CanelaAi-select"
              value={current || ''}
              title={personas.find((persona) => persona.id === current)?.description}
              onchange={(event: Event) => (conversations.persona = (event.target as HTMLSelectElement).value)}
            >
              {personas.map((persona) => (
                <option value={persona.id}>{persona.name}</option>
              ))}
            </select>
            <Icon name="fas fa-angle-down" />
          </span>
        </div>
      </div>
    );
  }

  remainingView(): Mithril.Children {
    const remaining = aiInfo()?.remaining;

    if (typeof remaining !== 'number') return null;

    return <p className={classList('CanelaAi-remaining', { 'is-out': remaining <= 0 })}>{t('ai.bot.remaining', { count: remaining })}</p>;
  }

  // ── Conversa aberta ───────────────────────────────────────────────────────

  conversationView(): Mithril.Children {
    if (conversations.missing) {
      return <p className="CanelaAi-empty">{app.translator.trans('core.forum.error.not_found_text')}</p>;
    }

    const conversation = conversations.current();

    return (
      <div className="CanelaAiConversation">
        <h1 className="CanelaAiConversation-title">{conversation?.title || (conversations.sending ? indicatorWave() : t('ai.bot.untitled'))}</h1>
        {conversations.loadingMessages ? (
          <LoadingIndicator display="block" />
        ) : (
          <div className="CanelaAiConversation-stream">{conversations.messages.map((message) => this.messageView(message))}</div>
        )}
        <div className="ai-bot-docked-composer CanelaAiConversation-composer">
          {!this.stickToBottom && (
            <button type="button" className="ai-bot-scroll-indicator" aria-label={t('ai.bot.scroll_to_bottom')} onclick={() => this.scrollToBottom()}>
              {conversations.sending ? (
                <span className="ai-bot-scroll-indicator__dots">
                  <span className="ai-bot-scroll-indicator__dot" />
                  <span className="ai-bot-scroll-indicator__dot" />
                  <span className="ai-bot-scroll-indicator__dot" />
                </span>
              ) : (
                <Icon name="fas fa-chevron-down" />
              )}
            </button>
          )}
          {this.inputView(true)}
          <p className="ai-disclaimer">{t('ai.bot.disclaimer')}</p>
        </div>
      </div>
    );
  }

  messageView(message: AiMessage): Mithril.Children {
    const bot = message.role === 'assistant';
    const user = app.session.user;
    const persona = (aiInfo()?.personas || []).find((item) => item.id === conversations.current()?.persona);

    return (
      <article
        key={message.id}
        className={classList('CanelaAiPost', bot ? 'CanelaAiPost--bot' : 'CanelaAiPost--user', { streaming: message.streaming })}
      >
        <div className="CanelaAiPost-avatar">
          {bot ? (
            <span className="Avatar CanelaAiPost-botAvatar">
              <Icon name="fas fa-robot" />
            </span>
          ) : (
            <Avatar user={user} />
          )}
        </div>
        <div className="CanelaAiPost-body">
          <header className="CanelaAiPost-header">
            <span className="CanelaAiPost-name">{bot ? persona?.name || t('ai.bot.title') : user?.displayName()}</span>
            {bot && message.model && <span className="agent-flair__model">{message.model}</span>}
            {bot && message.streaming && conversations.sending && (
              <Button className="Button Button--text CanelaAiPost-stop" icon="fas fa-stop" onclick={() => conversations.stop()}>
                {t('ai.bot.cancel_streaming')}
              </Button>
            )}
          </header>
          {bot && toolDetails(message.tools)}
          {bot && message.streaming && !message.content ? (
            <div className="CanelaAiPost-thinking">{indicatorWave()}</div>
          ) : (
            <Cooked className="streamable-content" text={message.content} streaming={bot && !!message.streaming && conversations.sending} />
          )}
        </div>
      </article>
    );
  }

  // ── Campo de pergunta ─────────────────────────────────────────────────────

  inputView(docked: boolean): Mithril.Children {
    const remaining = aiInfo()?.remaining;
    const disabled = typeof remaining === 'number' && remaining <= 0;
    const canSubmit = !disabled && !conversations.sending && this.input.trim().length >= 2;

    return (
      <div className={classList('ai-bot-conversations__input-wrapper', { '--disabled': disabled, 'is-docked': docked })}>
        <textarea
          id={INPUT_ID}
          rows={docked ? 3 : 1}
          disabled={disabled}
          placeholder={t('ai.bot.placeholder')}
          value={this.input}
          oncreate={(vnode: Mithril.VnodeDOM) => {
            this.textarea = vnode.dom as HTMLTextAreaElement;
            if (!docked) this.textarea.focus();
            this.autoExpand();
          }}
          oninput={(event: InputEvent) => {
            this.input = (event.target as HTMLTextAreaElement).value;
            this.autoExpand();
          }}
          onkeydown={(event: KeyboardEvent) => {
            // Enter manda, Shift+Enter quebra a linha — e o Enter que confirma
            // uma composição (acentos, IME) não conta.
            if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
              event.preventDefault();
              this.submit();
            }
          }}
        />
        <Button
          className={classList('Button Button--icon Button--flat ai-conversation-submit', { 'is-ready': canSubmit })}
          icon={conversations.sending ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane'}
          disabled={!canSubmit}
          aria-label={t('ai.bot.submit')}
          title={t('ai.bot.submit')}
          onclick={() => this.submit()}
        />
      </div>
    );
  }

  submit(): void {
    const question = this.input.trim();

    if (question.length < 2 || conversations.sending) return;

    this.input = '';
    this.stickToBottom = true;

    if (this.textarea) {
      this.textarea.value = '';
      this.autoExpand();
    }

    conversations.send(question).then(() => {
      // A pergunta que voltou de um erro reaparece no campo.
      if (conversations.restoreQuestion) {
        this.input = conversations.restoreQuestion;
        conversations.restoreQuestion = null;
        m.redraw();
      }
    });
  }

  /** O campo cresce com o texto até 30% da altura da tela, como no Discourse. */
  autoExpand(): void {
    const textarea = this.textarea;

    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > parseInt(getComputedStyle(textarea).maxHeight, 10) ? 'auto' : 'hidden';
  }

  onScroll(): void {
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;

    if (atBottom !== this.stickToBottom) {
      this.stickToBottom = atBottom;
      m.redraw();
    }
  }

  scrollToBottom(): void {
    this.stickToBottom = true;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }
}
