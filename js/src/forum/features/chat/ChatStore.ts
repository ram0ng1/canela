/*
 * O estado do chat no fórum — canais, conversa aberta, gaveta e
 * acompanhamento das não lidas, num objeto só:
 *
 * - os canais do leitor, com as contagens de não lidas e menções;
 * - um "painel" por conversa aberta (canal ou fio), com as mensagens
 *   carregadas por cursor, o composer, quem está digitando;
 * - a gaveta (aberta, expandida, a rota de dentro dela e o tamanho);
 * - a entrega: o evento `canelaChat` do websocket do flarum/realtime e, sem
 *   ele, o polling a cada poucos segundos.
 */
import app from 'flarum/forum/app';

import { caps, chatOn, chatRequest, countReaction, meId, playSound, preference, pushUsers, readLocal, writeLocal } from './utils';
import type { ChatChannel, ChatEvent, ChatMessage, ChatRoute, ChatThread, ChatUpload } from './types';

const PAGE = 50;

export interface PendingUpload {
  key: string;
  name: string;
  preview: string | null;
  upload: ChatUpload | null;
  error: string | null;
}

let stagedCounter = 0;

/** Uma conversa aberta: a principal de um canal, ou um fio. */
export class ChatPane {
  messages: ChatMessage[] = [];
  loaded = false;
  loading = false;
  loadingPast = false;
  loadingFuture = false;
  canLoadMorePast = false;
  canLoadMoreFuture = false;

  /** A última lida quando a conversa abriu: é ali que fica o "último acesso". */
  lastReadAtOpen: number | null = null;
  targetMessageId: number | null = null;
  highlightedId: number | null = null;
  since: string | null = null;

  replyTo: ChatMessage | null = null;
  editing: ChatMessage | null = null;
  uploads: PendingUpload[] = [];
  sending = false;
  text = '';

  /** userId => quando o aviso de "digitando" expira. */
  typing = new Map<number, number>();
  typingNames = new Map<number, string>();

  atBottom = true;
  newSinceAway = 0;
  mounted = 0;

  private readTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRead = 0;

  constructor(
    readonly store: ChatStore,
    readonly channelId: number,
    readonly threadId: number | null
  ) {
    this.text = readLocal<string>(`draft.${this.key}`, '');
  }

  get key(): string {
    return this.threadId ? `t${this.threadId}` : `c${this.channelId}`;
  }

  get channel(): ChatChannel | undefined {
    return this.store.channels.get(this.channelId);
  }

  lastId(): number {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].id > 0) return this.messages[i].id;
    }

    return 0;
  }

  firstId(): number {
    return this.messages.find((m) => m.id > 0)?.id ?? 0;
  }

  find(id: number): ChatMessage | undefined {
    return this.messages.find((m) => m.id === id);
  }

  saveDraft(text: string): void {
    this.text = text;
    writeLocal(`draft.${this.key}`, text.trim() ? text : null);
  }

  /** Abre a conversa: em volta da mensagem pedida, da primeira não lida, ou no fim. */
  async load(around?: number | null): Promise<void> {
    this.loading = true;
    m.redraw();

    const channel = this.channel;
    const lastRead = channel?.membership?.lastReadMessageId ?? null;
    const unread = !this.threadId && channel?.membership && channel.membership.unreadCount > 0 && lastRead;
    const target = around || (unread ? lastRead : null);

    try {
      const result = await chatRequest('GET', `/channels/${this.channelId}/messages`, undefined, {
        around: target || undefined,
        thread: this.threadId || undefined,
        limit: PAGE,
      });

      pushUsers(result.users);
      this.messages = result.messages;
      this.canLoadMorePast = result.meta.canLoadMorePast;
      this.canLoadMoreFuture = result.meta.canLoadMoreFuture;
      this.targetMessageId = around || null;
      this.highlightedId = around || null;
      this.lastReadAtOpen = this.threadId ? null : lastRead;
      this.since = new Date().toISOString();
      this.loaded = true;
    } finally {
      this.loading = false;
      m.redraw();
    }
  }

  async loadPast(): Promise<void> {
    if (this.loadingPast || !this.canLoadMorePast || !this.firstId()) return;

    this.loadingPast = true;

    try {
      const result = await chatRequest('GET', `/channels/${this.channelId}/messages`, undefined, {
        before: this.firstId(),
        thread: this.threadId || undefined,
        limit: PAGE,
      });

      pushUsers(result.users);
      this.messages = [...result.messages.filter((m: ChatMessage) => !this.find(m.id)), ...this.messages];
      this.canLoadMorePast = result.meta.canLoadMorePast;
    } finally {
      this.loadingPast = false;
      m.redraw();
    }
  }

  async loadFuture(): Promise<void> {
    if (this.loadingFuture || !this.canLoadMoreFuture || !this.lastId()) return;

    this.loadingFuture = true;

    try {
      const result = await chatRequest('GET', `/channels/${this.channelId}/messages`, undefined, {
        after: this.lastId(),
        thread: this.threadId || undefined,
        limit: PAGE,
      });

      pushUsers(result.users);
      result.messages.forEach((message: ChatMessage) => this.upsert(message));
      this.canLoadMoreFuture = result.meta.canLoadMoreFuture;
    } finally {
      this.loadingFuture = false;
      m.redraw();
    }
  }

  /** "Pular para o fim": sem o fim carregado, recarrega a conversa a partir dele. */
  async jumpToBottom(): Promise<void> {
    this.newSinceAway = 0;

    if (this.canLoadMoreFuture) {
      this.targetMessageId = null;
      this.highlightedId = null;

      const result = await chatRequest('GET', `/channels/${this.channelId}/messages`, undefined, { thread: this.threadId || undefined, limit: PAGE });

      pushUsers(result.users);
      this.messages = result.messages;
      this.canLoadMorePast = result.meta.canLoadMorePast;
      this.canLoadMoreFuture = false;
    }

    this.store.emit('scroll-bottom', this.key);
    m.redraw();
  }

  /** Põe (ou troca) a mensagem no lugar certo, pela ordem do id. */
  upsert(message: ChatMessage): void {
    const index = this.messages.findIndex((m) => m.id === message.id);

    if (index >= 0) {
      this.messages[index] = { ...message, expanded: this.messages[index].expanded };
      return;
    }

    // Só entra se o fim da conversa está carregado: senão ela apareceria
    // colada a mensagens antigas, com um buraco no meio.
    if (this.canLoadMoreFuture) return;

    let at = this.messages.length;

    while (at > 0 && (this.messages[at - 1].id < 0 || this.messages[at - 1].id > message.id)) at--;

    // As enviadas daqui que ainda não voltaram ficam sempre por último.
    this.messages.splice(at, 0, message);
  }

  remove(id: number): void {
    this.messages = this.messages.filter((m) => m.id !== id);
  }

  /** Se a mensagem pertence a esta conversa. */
  accepts(message: Pick<ChatMessage, 'channelId' | 'threadId' | 'isThreadOriginal'>): boolean {
    if (message.channelId !== this.channelId) return false;
    if (this.threadId) return message.threadId === this.threadId;

    return !message.threadId || message.isThreadOriginal || !this.channel?.threadingEnabled;
  }

  // ─── Envio ────────────────────────────────────────────────────────────────

  async send(text: string): Promise<void> {
    const uploads = this.uploads.filter((u) => u.upload).map((u) => u.upload!);

    if (!text.trim() && !uploads.length) return;

    if (this.editing) {
      const editing = this.editing;

      this.editing = null;
      this.sending = true;

      try {
        const result = await chatRequest('PATCH', `/messages/${editing.id}`, { message: text, uploadIds: uploads.map((u) => u.id) });
        pushUsers(result.users);
        this.store.upsertEverywhere(result.message);
        this.resetComposer();
      } catch (error) {
        this.editing = editing;
        throw error;
      } finally {
        this.sending = false;
        m.redraw();
      }

      return;
    }

    const key = `s${++stagedCounter}`;
    const replyTo = this.replyTo;
    const staged: ChatMessage = {
      id: -stagedCounter,
      stagedKey: key,
      staged: true,
      channelId: this.channelId,
      threadId: this.threadId,
      isThreadOriginal: false,
      userId: meId(),
      message: text,
      cooked: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`,
      excerpt: text,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      deletedById: null,
      inReplyTo:
        replyTo && !this.channel?.threadingEnabled ? { id: replyTo.id, userId: replyTo.userId, excerpt: replyTo.excerpt, deleted: false } : null,
      reactions: [],
      uploads,
      pinned: false,
      pinnedById: null,
      pinnedAt: null,
      thread: null,
    };

    // Responder com os fios ligados leva a conversa para o fio: a mensagem
    // não aparece aqui, mas no painel do fio, que abre sozinho.
    const toThread = !!(replyTo && !this.threadId && this.channel?.threadingEnabled);

    if (!toThread) {
      if (this.canLoadMoreFuture) await this.jumpToBottom();
      this.messages.push(staged);
      this.store.emit('scroll-bottom', this.key);
    }

    this.resetComposer();
    this.sending = true;
    m.redraw();

    await this.post(staged, replyTo?.id ?? null, uploads, toThread);
  }

  async post(staged: ChatMessage, inReplyToId: number | null, uploads: ChatUpload[], toThread = false): Promise<void> {
    try {
      const result = await chatRequest(
        'POST',
        `/channels/${this.channelId}/messages`,
        { message: staged.message, inReplyToId, threadId: this.threadId, uploadIds: uploads.map((u) => u.id) },
        undefined,
        { errorHandler: () => {} }
      );

      pushUsers(result.users);
      this.messages = this.messages.filter((m) => m.stagedKey !== staged.stagedKey);

      const message: ChatMessage = result.message;

      this.store.upsertEverywhere(message);
      this.store.afterOwnMessage(message);

      if (toThread && message.threadId) {
        this.store.openThread(this.channelId, message.threadId);
      }
    } catch (error: any) {
      const detail = error?.response?.errors?.[0]?.detail;

      staged.error = detail || 'network';
      staged.stagedKey ||= `s${++stagedCounter}`;

      if (toThread) {
        app.alerts.show({ type: 'error' }, detail || String(error?.message || error));
      }
    } finally {
      this.sending = false;
      m.redraw();
    }
  }

  retry(staged: ChatMessage): void {
    staged.error = null;
    m.redraw();
    this.post(staged, staged.inReplyTo?.id ?? null, staged.uploads);
  }

  resetComposer(): void {
    this.replyTo = null;
    this.editing = null;
    this.uploads = [];
    this.saveDraft('');
    this.store.sendTyping(this, false);
  }

  startEdit(message: ChatMessage): void {
    this.editing = message;
    this.replyTo = null;
    this.text = message.message;
    this.uploads = message.uploads.map((upload) => ({ key: `u${upload.id}`, name: upload.name, preview: upload.url, upload, error: null }));
    this.store.emit('focus-composer', this.key);
    m.redraw();
  }

  startReply(message: ChatMessage): void {
    // Com os fios ligados, "Responder" abre o fio da mensagem.
    if (!this.threadId && this.channel?.threadingEnabled && message.thread) {
      this.store.openThread(this.channelId, message.thread.id);
      return;
    }

    this.replyTo = message;
    this.editing = null;
    this.store.emit('focus-composer', this.key);
    m.redraw();
  }

  // ─── Leitura ──────────────────────────────────────────────────────────────

  /** Marca lido até a mensagem, agrupando as chamadas de uma rolagem inteira. */
  markRead(messageId: number): void {
    if (messageId <= 0) return;

    const channel = this.channel;

    if (!this.threadId) {
      const membership = channel?.membership;

      if (!membership || (membership.lastReadMessageId ?? 0) >= messageId) {
        if (membership && membership.unreadCount && messageId >= (channel?.lastMessageId ?? 0)) membership.unreadCount = 0;
        return;
      }

      membership.lastReadMessageId = messageId;

      if (messageId >= (channel!.lastMessageId ?? 0)) {
        membership.unreadCount = 0;
        membership.mentionCount = 0;
      }
    }

    this.pendingRead = Math.max(this.pendingRead, messageId);

    if (this.readTimer) clearTimeout(this.readTimer);

    this.readTimer = setTimeout(() => {
      const id = this.pendingRead;

      this.pendingRead = 0;
      this.readTimer = null;

      const path = this.threadId ? `/threads/${this.threadId}/read` : `/channels/${this.channelId}/read`;

      chatRequest('POST', path, { messageId: id }, undefined, { errorHandler: () => {} })
        .then((result: any) => {
          if (result?.channel) this.store.putChannel(result.channel);
          if (result?.users) pushUsers(result.users);
          if (this.threadId) this.store.refreshSoon();
        })
        .catch(() => {});
    }, 800);

    m.redraw();
  }

  // ─── Anexos ───────────────────────────────────────────────────────────────

  async addFiles(files: FileList | File[]): Promise<void> {
    const max = (caps().uploadMaxKb || 4096) * 1024;

    for (const file of Array.from(files)) {
      if (this.uploads.length >= 10) break;

      const item: PendingUpload = {
        key: `p${++stagedCounter}`,
        name: file.name,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        upload: null,
        error: null,
      };

      this.uploads.push(item);
      m.redraw();

      if (file.size > max) {
        item.error = 'too_large';
        continue;
      }

      const body = new FormData();
      body.append('file', file);

      try {
        const result = await chatRequest('POST', '/uploads', body);
        item.upload = result.upload;
      } catch {
        item.error = 'failed';
      }

      m.redraw();
    }
  }

  removeUpload(key: string): void {
    this.uploads = this.uploads.filter((u) => u.key !== key);
  }

  // ─── Polling ──────────────────────────────────────────────────────────────

  async poll(): Promise<void> {
    if (!this.loaded || this.loading) return;

    const result = await chatRequest(
      'GET',
      `/channels/${this.channelId}/updates`,
      undefined,
      {
        after: this.lastId() || undefined,
        since: this.since || undefined,
        thread: this.threadId || undefined,
      },
      { errorHandler: () => {} }
    );

    pushUsers(result.users);
    this.since = result.now;

    const fresh = (result.messages as ChatMessage[]).filter((m) => !this.find(m.id));

    result.messages.forEach((message: ChatMessage) => this.upsert(message));
    result.changed.forEach((message: ChatMessage) => this.upsert(message));
    (result.removedIds as number[]).forEach((id) => this.remove(id));

    this.typing.clear();
    (result.typingUserIds as number[]).forEach((id) => this.typing.set(id, Date.now() + 6000));

    if (fresh.length) {
      fresh.forEach((message) => this.store.noteIncoming(message));
      this.store.emit('messages-added', this.key);
    }

    m.redraw();
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

interface DrawerState {
  open: boolean;
  expanded: boolean;
  route: ChatRoute;
  width: number;
  height: number;
}

type Listener = (key: string) => void;

export class ChatStore {
  channels = new Map<number, ChatChannel>();
  loaded = false;
  loading = false;

  panes = new Map<string, ChatPane>();
  threads = new Map<number, ChatThread>();

  drawer: DrawerState = readLocal<DrawerState>('drawer', { open: false, expanded: true, route: { name: 'channels' }, width: 400, height: 530 });

  /** O leitor prefere a página cheia (o último jeito que ele usou). */
  prefersFullPage = readLocal<boolean>('fullPage', false);

  /** A conversa ativa da página cheia (para destacar na barra lateral). */
  activeChannelId: number | null = null;

  private listeners = new Map<string, Set<Listener>>();
  private boundChannel: any = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private stateTimer: ReturnType<typeof setInterval> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private lastStateAt = 0;
  private typingSentAt = new Map<string, number>();

  // ─── Eventos internos (rolar, focar o composer) ──────────────────────────

  on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);

    return () => this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, key: string): void {
    this.listeners.get(event)?.forEach((listener) => listener(key));
  }

  // ─── Canais ───────────────────────────────────────────────────────────────

  start(): void {
    if (!chatOn() || this.stateTimer) return;

    this.loadState();

    // O websocket do flarum/realtime aparece depois do mount, e é recriado a
    // cada reconexão: conferir de tempos em tempos liga o evento no canal novo.
    this.stateTimer = setInterval(() => {
      this.attachRealtime();

      const idle = Date.now() - this.lastStateAt;
      const every = this.realtime() ? 120000 : Math.max(15000, (caps().pollSeconds || 5) * 4000);

      if (idle > every && document.visibilityState === 'visible') this.loadState();
    }, 3000);

    this.pollTimer = setInterval(() => this.pollPanes(), Math.max(2, caps().pollSeconds || 5) * 1000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.loadState();
    });
  }

  async loadState(): Promise<void> {
    if (this.loading || !chatOn()) return;

    this.loading = true;
    this.lastStateAt = Date.now();

    try {
      const result = await chatRequest('GET', '/state', undefined, undefined, { errorHandler: () => {} });

      pushUsers(result.users);

      const seen = new Set<number>();

      (result.channels as ChatChannel[]).forEach((channel) => {
        seen.add(channel.id);
        this.putChannel(channel);
      });

      // Canais de que o leitor saiu continuam no mapa só se uma conversa
      // aberta ainda os usa (a prévia de um canal público, por exemplo).
      this.channels.forEach((channel, id) => {
        if (!seen.has(id) && channel.membership?.following) channel.membership.following = false;
      });

      this.loaded = true;
    } catch {
      // Sem a API (o chat desligado agora, ou as tabelas ainda não migradas):
      // fica tudo como está, e a próxima volta tenta de novo.
    } finally {
      this.loading = false;
      m.redraw();
    }
  }

  /** Recarrega o estado daqui a pouco, juntando vários pedidos num só. */
  refreshSoon(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.loadState();
    }, 600);
  }

  putChannel(channel: ChatChannel): ChatChannel {
    const existing = this.channels.get(channel.id);

    if (existing) {
      Object.assign(existing, channel);
      return existing;
    }

    this.channels.set(channel.id, channel);

    return channel;
  }

  async fetchChannel(id: number): Promise<ChatChannel> {
    const result = await chatRequest('GET', `/channels/${id}`);

    pushUsers(result.users);

    return this.putChannel(result.channel);
  }

  publicChannels(): ChatChannel[] {
    return [...this.channels.values()]
      .filter((c) => c.type === 'public' && c.membership?.following)
      .sort((a, b) => Number(!!b.membership?.starred) - Number(!!a.membership?.starred) || (a.name || '').localeCompare(b.name || ''));
  }

  /** As MDs, da conversa mais recente para a mais antiga. */
  directChannels(): ChatChannel[] {
    return [...this.channels.values()]
      .filter((c) => c.type === 'direct' && c.membership?.following)
      .sort((a, b) => (b.lastMessageId ?? b.id * -1) - (a.lastMessageId ?? a.id * -1));
  }

  unread(channel: ChatChannel): number {
    return channel.membership && !channel.membership.muted ? channel.membership.unreadCount : 0;
  }

  /** O número verde: menções, e toda MD não lida. */
  urgent(channel: ChatChannel): number {
    const membership = channel.membership;

    if (!membership || membership.muted) return 0;

    return channel.type === 'direct' ? membership.unreadCount : membership.mentionCount;
  }

  totals(): { urgent: number; mentions: number; unread: boolean; threads: number; dmUrgent: number; publicUrgent: number } {
    let urgent = 0;
    let mentions = 0;
    let unread = false;
    let threads = 0;
    let dmUrgent = 0;
    let publicUrgent = 0;

    this.channels.forEach((channel) => {
      if (!channel.membership?.following) return;

      const u = this.urgent(channel);

      urgent += u;
      mentions += channel.membership.muted ? 0 : channel.membership.mentionCount;
      threads += channel.membership.muted ? 0 : channel.membership.unreadThreadsCount;
      if (channel.type === 'direct') dmUrgent += u;
      else publicUrgent += u;
      if (this.unread(channel) > 0) unread = true;
    });

    return { urgent, mentions, unread, threads, dmUrgent, publicUrgent };
  }

  // ─── Painéis ──────────────────────────────────────────────────────────────

  pane(channelId: number, threadId: number | null = null): ChatPane {
    const key = threadId ? `t${threadId}` : `c${channelId}`;
    let pane = this.panes.get(key);

    if (!pane) {
      pane = new ChatPane(this, channelId, threadId);
      this.panes.set(key, pane);
    }

    return pane;
  }

  async fetchThread(threadId: number): Promise<ChatThread> {
    const result = await chatRequest('GET', `/threads/${threadId}`);

    pushUsers(result.users);
    this.threads.set(threadId, result.thread);

    return result.thread;
  }

  /** Abre o fio no lugar certo: o painel lateral da página cheia ou a gaveta. */
  openThread(channelId: number, threadId: number, messageId?: number): void {
    const channel = this.channels.get(channelId);

    if (this.isFullPage()) {
      m.route.set(`${channel ? channelPathFor(channel) : `/chat/c/-/${channelId}`}/t/${threadId}${messageId ? `/${messageId}` : ''}`);
    } else {
      this.navigate({ name: 'thread', channelId, threadId, messageId });
    }
  }

  isFullPage(): boolean {
    return String(app.current.get('routeName') || '').startsWith('canela.chat');
  }

  upsertEverywhere(message: ChatMessage): void {
    this.panes.forEach((pane) => {
      if (pane.find(message.id) || (pane.loaded && pane.accepts(message))) pane.upsert(message);

      // A original de um fio aparece nos dois painéis: no do canal (com o
      // indicador) e no topo do painel do fio.
      if (pane.threadId && message.thread?.id === pane.threadId && pane.find(message.id)) pane.upsert(message);
    });

    m.redraw();
  }

  /** Depois de enviar: a conversa conta como lida e a MD vai para o topo. */
  afterOwnMessage(message: ChatMessage): void {
    const channel = this.channels.get(message.channelId);

    if (channel) {
      if (!message.threadId || message.isThreadOriginal) {
        channel.lastMessageId = message.id;
        channel.lastMessage = { id: message.id, userId: message.userId, excerpt: message.excerpt, createdAt: message.createdAt };
      }

      if (channel.membership) {
        channel.membership.following = true;
        if (!message.threadId) channel.membership.lastReadMessageId = message.id;
      }
    } else {
      this.refreshSoon();
    }

    if (message.threadId) this.refreshThreadOriginal(message.channelId, message.threadId);
  }

  /** Atualiza o indicador "N respostas" da original de um fio. */
  async refreshThreadOriginal(channelId: number, threadId: number): Promise<void> {
    const pane = this.panes.get(`c${channelId}`);
    const original = pane?.messages.find((m) => m.thread?.id === threadId || (m.threadId === threadId && m.isThreadOriginal));
    const thread = this.threads.get(threadId);
    const id = original?.id ?? thread?.originalMessage?.id;

    if (!id) return;

    try {
      const result = await chatRequest('GET', `/messages/${id}`, undefined, undefined, { errorHandler: () => {} });

      pushUsers(result.users);
      this.upsertEverywhere(result.message);
    } catch {
      // A original pode ter sido apagada nesse meio-tempo.
    }
  }

  // ─── Navegação da gaveta ─────────────────────────────────────────────────

  saveDrawer(): void {
    writeLocal('drawer', this.drawer);
  }

  navigate(route: ChatRoute): void {
    this.drawer.route = route;
    this.drawer.open = true;
    this.drawer.expanded = true;
    this.saveDrawer();
    m.redraw();
  }

  openDrawer(route?: ChatRoute): void {
    if (route) this.drawer.route = route;

    this.drawer.open = true;
    this.drawer.expanded = true;
    this.prefersFullPage = false;
    writeLocal('fullPage', false);
    this.saveDrawer();
    m.redraw();
  }

  closeDrawer(): void {
    this.drawer.open = false;
    this.saveDrawer();
    m.redraw();
  }

  toggleExpand(): void {
    this.drawer.expanded = !this.drawer.expanded;
    this.saveDrawer();
    m.redraw();
  }

  /** O ícone do cabeçalho: a página cheia para quem a prefere (e no celular), senão a gaveta. */
  toggleFromHeader(): void {
    if (app.screen() === 'phone' || this.prefersFullPage) {
      if (this.isFullPage()) return;

      m.route.set(app.route('canela.chat'));
      return;
    }

    if (this.isFullPage()) return;

    if (this.drawer.open) this.closeDrawer();
    else this.openDrawer();
  }

  /** "Abrir chat em tela cheia" a partir da gaveta, na mesma conversa. */
  openFullPage(): void {
    const route = this.drawer.route;

    this.prefersFullPage = true;
    writeLocal('fullPage', true);
    this.drawer.open = false;
    this.saveDrawer();

    m.route.set(routeUrl(route, this));
  }

  /** "Fechar chat em tela cheia": volta para o fórum, com a conversa na gaveta. */
  closeFullPage(route: ChatRoute): void {
    this.prefersFullPage = false;
    writeLocal('fullPage', false);
    this.drawer.route = route;
    this.drawer.open = true;
    this.drawer.expanded = true;
    this.saveDrawer();

    const previous = (app.history as any)?.getPrevious?.();

    if (previous && !String(previous.name || '').startsWith('canela.chat')) app.history.back();
    else m.route.set(app.route('index'));
  }

  // ─── Tempo real ───────────────────────────────────────────────────────────

  realtime(): boolean {
    const socket = (app as any).websocket;

    return !!(this.boundChannel && socket?.connection?.state === 'connected');
  }

  attachRealtime(): void {
    const channel = (app as any).websocket_channels?.user;

    if (!channel || channel === this.boundChannel) return;

    this.boundChannel = channel;
    channel.bind('canelaChat', (data: ChatEvent) => this.handle(data));
  }

  private pollPanes(): void {
    if (this.realtime() || document.visibilityState !== 'visible') {
      // Mesmo com o websocket, os avisos de "digitando" vencem sozinhos.
      this.expireTyping();
      return;
    }

    this.panes.forEach((pane) => {
      if (pane.mounted > 0) pane.poll().catch(() => {});
    });
  }

  private expireTyping(): void {
    const now = Date.now();
    let changed = false;

    this.panes.forEach((pane) =>
      pane.typing.forEach((until, id) => {
        if (until < now) {
          pane.typing.delete(id);
          changed = true;
        }
      })
    );

    if (changed) m.redraw();
  }

  /** Avisa que o leitor está digitando — no máximo a cada 4 s. */
  sendTyping(pane: ChatPane, typing: boolean): void {
    const last = this.typingSentAt.get(pane.key) || 0;

    if (typing && Date.now() - last < 4000) return;
    if (!typing && !last) return;

    this.typingSentAt.set(pane.key, typing ? Date.now() : 0);

    chatRequest('POST', `/channels/${pane.channelId}/typing`, { typing, threadId: pane.threadId }, undefined, { errorHandler: () => {} }).catch(
      () => {}
    );
  }

  /** Uma mensagem nova de outra pessoa: contagens, som. */
  noteIncoming(message: ChatMessage, mentioned = false): void {
    if (message.userId === meId()) return;

    const channel = this.channels.get(message.channelId);

    if (!channel) {
      this.refreshSoon();
      return;
    }

    const mainStream = !message.threadId || message.isThreadOriginal || !channel.threadingEnabled;

    if (mainStream) {
      channel.lastMessageId = Math.max(channel.lastMessageId || 0, message.id);
      channel.lastMessage = { id: message.id, userId: message.userId, excerpt: message.excerpt, createdAt: message.createdAt };
    }

    const membership = channel.membership;

    if (membership?.following && mainStream && message.id > (membership.lastReadMessageId ?? 0)) {
      membership.unreadCount++;
      if (mentioned) membership.mentionCount++;
    }

    if (membership && !membership.muted && (channel.type === 'direct' || mentioned)) {
      playSound(preference('canelaChatSound', 'none'));
    }
  }

  async handle(event: ChatEvent): Promise<void> {
    const me = meId();

    switch (event.type) {
      case 'message.created':
      case 'message.updated':
      case 'pin': {
        if (!event.messageId) return;

        let message: ChatMessage;

        try {
          const result = await chatRequest('GET', `/messages/${event.messageId}`, undefined, undefined, { errorHandler: () => {} });
          pushUsers(result.users);
          message = result.message;
        } catch {
          return;
        }

        const isNew = event.type === 'message.created' && !this.panesHave(message.id);

        this.upsertEverywhere(message);

        if (isNew) {
          this.noteIncoming(message, (event.mentionedUserIds || []).includes(me));
          this.panes.forEach((pane) => {
            if (pane.accepts(message)) {
              pane.typing.delete(message.userId || 0);
              this.emit('messages-added', pane.key);
            }
          });

          if (message.threadId && !message.isThreadOriginal) this.refreshThreadOriginal(message.channelId, message.threadId);
          if (!this.channels.has(message.channelId)) this.refreshSoon();
        }

        if (event.type === 'pin' && event.userId !== me) {
          const channel = this.channels.get(event.channelId);
          if (channel?.membership && event.pinned) channel.membership.hasUnseenPins = true;
        }

        break;
      }

      case 'message.deleted':
        this.panes.forEach((pane) => {
          const message = event.messageId ? pane.find(event.messageId) : undefined;

          if (!message) return;

          const channel = this.channels.get(pane.channelId);

          if (message.userId === me || channel?.canModerate) {
            message.deletedAt = event.deletedAt || new Date().toISOString();
            message.deletedById = event.deletedById ?? null;
          } else {
            pane.remove(message.id);
          }
        });

        if (event.threadId) this.refreshThreadOriginal(event.channelId, event.threadId);
        this.refreshSoon();
        break;

      case 'reaction':
        this.panes.forEach((pane) => {
          const message = event.messageId ? pane.find(event.messageId) : undefined;

          if (message && event.emoji && event.userId) applyReaction(message, event.emoji, event.userId, event.action !== 'remove');
        });
        break;

      case 'typing':
        this.panes.forEach((pane) => {
          if (pane.channelId !== event.channelId || (pane.threadId || null) !== (event.threadId || null) || !event.userId) return;

          if (event.typing) {
            pane.typing.set(event.userId, Date.now() + 6000);
            if (event.username) pane.typingNames.set(event.userId, event.username);
          } else {
            pane.typing.delete(event.userId);
          }
        });
        break;

      case 'read':
        if (event.lastReadMessageId) {
          const channel = this.channels.get(event.channelId);

          if (channel?.membership && (channel.membership.lastReadMessageId ?? 0) < event.lastReadMessageId) {
            channel.membership.lastReadMessageId = event.lastReadMessageId;
          }
        }

        this.refreshSoon();
        break;

      case 'channel.deleted':
        this.channels.delete(event.channelId);
        this.refreshSoon();
        break;

      default:
        // channel.updated, membership, thread.updated: o estado inteiro de novo.
        this.refreshSoon();

        if (this.channels.has(event.channelId)) this.fetchChannel(event.channelId).catch(() => {});
        if (event.threadId) this.fetchThread(event.threadId).catch(() => {});
    }

    m.redraw();
  }

  private panesHave(id: number): boolean {
    for (const pane of this.panes.values()) if (pane.find(id)) return true;

    return false;
  }

  /** Reage (ou tira a reação) já na tela, e confirma pela API. */
  async react(message: ChatMessage, char: string, add?: boolean): Promise<void> {
    const reaction = message.reactions.find((r) => r.emoji === char);
    const adding = add ?? !reaction?.userIds.includes(meId());

    applyReaction(message, char, meId(), adding);
    if (adding) countReaction(char);
    m.redraw();

    try {
      const result = await chatRequest('POST', `/messages/${message.id}/reactions`, { emoji: char, action: adding ? 'add' : 'remove' });
      pushUsers(result.users);
      this.upsertEverywhere(result.message);
    } catch {
      applyReaction(message, char, meId(), !adding);
      m.redraw();
    }
  }
}

function applyReaction(message: ChatMessage, char: string, userId: number, add: boolean): void {
  let reaction = message.reactions.find((r) => r.emoji === char);

  if (add) {
    if (reaction?.userIds.includes(userId)) return;

    if (!reaction) {
      reaction = { emoji: char, count: 0, userIds: [] };
      message.reactions.push(reaction);
    }

    reaction.count++;
    reaction.userIds.push(userId);
  } else if (reaction && reaction.userIds.includes(userId)) {
    reaction.count--;
    reaction.userIds = reaction.userIds.filter((id) => id !== userId);

    if (reaction.count <= 0) message.reactions = message.reactions.filter((r) => r !== reaction);
  }
}

function channelPathFor(channel: ChatChannel): string {
  return app.route('canela.chat.channel', { slug: channel.slug || '-', id: channel.id });
}

/** O endereço da página cheia que corresponde a uma rota da gaveta. */
export function routeUrl(route: ChatRoute, store: ChatStore): string {
  const base = app.route('canela.chat');
  const channel = 'channelId' in route ? store.channels.get(route.channelId) : undefined;
  const path = channel ? channelPathFor(channel) : 'channelId' in route ? `${base}/c/-/${route.channelId}` : base;

  switch (route.name) {
    case 'channel':
      return path + (route.messageId ? `/${route.messageId}` : '');
    case 'thread':
      return `${path}/t/${route.threadId}${route.messageId ? `/${route.messageId}` : ''}`;
    case 'channel-threads':
      return `${path}/t`;
    case 'channel-pins':
      return `${path}/pins`;
    case 'channel-info':
      return `${path}/info/${route.tab}`;
    case 'browse':
      return `${base}/browse${route.filter ? `/${route.filter}` : ''}`;
    case 'new-message':
      return `${base}/new-message`;
    case 'direct-messages':
      return `${base}/direct-messages`;
    case 'threads':
      return `${base}/threads`;
    case 'search':
      return `${base}/search`;
    default:
      return `${base}/channels`;
  }
}

/** O singleton do chat no fórum. */
const chat = new ChatStore();

export default chat;
