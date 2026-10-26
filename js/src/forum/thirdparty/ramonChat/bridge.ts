/*
 * A ponte com o ramon/chat: o tema nunca importa um módulo dele (sem a
 * extensão, o import quebraria o tema inteiro). Tudo vem do registro do
 * Flarum (`flarum.reg`), onde o ramon/chat registra cada módulo com o
 * caminho do arquivo (`forum/state/chat`, `forum/utils/surface`…), e só
 * quando `ramon-chat` está em `flarum.extensions`.
 *
 * Os tipos aqui são só o pedaço da API dele que o tema usa — o bastante para
 * o TypeScript, sem acoplar o tema às classes da extensão.
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { isExtensionEnabled } from '../../utils/settings';

export const NAMESPACE = 'ramon-chat';

/** O pedaço do modelo `chat-channels` do ramon/chat que a barra lateral lê. */
export interface RamonChannel {
  id(): string | undefined;
  displayName(): string;
  description(): string | null;
  isDirect(): boolean;
  isPrivate(): boolean;
  isMuted(): boolean;
  hasUnread(): boolean;
  unreadCount(): number;
  unreadMentionsCount(): number;
  others(): User[];
}

/** O pedaço do `ChatState` (o estado global do chat, `forum/state/chat`) que o tema usa. */
export interface RamonChatState {
  channels: RamonChannel[];
  channelsLoaded: boolean;
  channelsLoading: boolean;
  activeChannelId: number | null;
  drawerOpen: boolean;
  categoryChannels(): RamonChannel[];
  directChannels(): RamonChannel[];
  loadChannels(force?: boolean): Promise<unknown>;
  loadDrafts(): Promise<unknown>;
  setActiveChannel(id: number | null): void;
  rememberChannel(channel: RamonChannel): void;
  seedEmptyChannel(id: number): void;
  prefetchChannel(id: number): void;
  unreadSummary(): { channels: number; messages: number; mentions: number };
}

/** Um módulo do ramon/chat já registrado, ou `null` (extensão desligada ou chunk ainda não baixado). */
export function ramonModule<T = any>(id: string): T | null {
  if (!isExtensionEnabled(NAMESPACE)) return null;

  try {
    return (flarum.reg.checkModule(NAMESPACE, id) as T) || null;
  } catch {
    return null;
  }
}

/** O estado global do chat: o mesmo objeto que a página, a gaveta e o tempo real do ramon/chat usam. */
export function chatState(): RamonChatState | null {
  return ramonModule<RamonChatState>('forum/state/chat');
}

/**
 * O leitor vê o chat: a mesma regra do `canUseChat()` do ramon/chat (que não
 * é exportada) — permissão no fórum, logado e sem ter desligado o chat nas
 * configurações.
 */
export function canUseChat(): boolean {
  if (!isExtensionEnabled(NAMESPACE) || !app.forum || !app.session.user) return false;
  if (!app.forum.attribute<boolean>('canUseChat')) return false;

  return app.session.user.preferences()?.['ramon-chat.enabled'] !== false;
}

/** Estamos na página cheia do chat (o ChatPage do ramon/chat põe esta classe no <body>). */
export function onChatPage(): boolean {
  return document.body.classList.contains('ChatFullPage');
}

/** A gaveta ou a página cheia, pela mesma regra do botão do cabeçalho do ramon/chat. */
function prefersDrawer(): boolean {
  const surface = ramonModule<{ shouldUseChatDrawer?: () => boolean }>('forum/utils/surface');

  try {
    return !!surface?.shouldUseChatDrawer?.();
  } catch {
    return false;
  }
}

/** Abre a gaveta do ramon/chat (o `ChatDrawer.open()` estático dele). */
function openDrawer(): boolean {
  const drawer = ramonModule<{ open?: () => Promise<void> }>('forum/components/ChatDrawer');

  if (!drawer?.open) return false;

  drawer.open().catch(() => {});

  return true;
}

/** O endereço de um canal, para o `href` (abrir em nova aba continua funcionando). */
export function channelUrl(id: number | string): string {
  return app.route('chat.channel', { id });
}

/**
 * Abre um canal: na gaveta, para quem a usa e não está na
 * página cheia; senão, na página do chat. No celular a barra lateral está
 * dentro do painel do hambúrguer — a navegação o fecha (o `Page` do core).
 */
export function openChannel(id: number): void {
  const state = chatState();

  if (!state) return;

  state.setActiveChannel(id);

  if (!onChatPage() && prefersDrawer() && openDrawer()) {
    m.redraw();
    return;
  }

  m.route.set(channelUrl(id));
}

/** Uma das telas do chat (`chat.threads`, `chat.search`, `chat.browse`…) na página cheia. */
export function openRoute(name: string): void {
  m.route.set(app.route(name));
}

/**
 * Abre (ou cria) a conversa direta com estas pessoas — o mesmo fluxo do
 * `startDirectMessage` do ramon/chat, que só aceita uma pessoa: aqui cabem
 * várias (a MD em grupo). O POST devolve o canal serializado.
 */
export async function startDirect(userIds: number[]): Promise<boolean> {
  const state = chatState();

  if (!state || !userIds.length) return false;

  const payload = await app.request<any>({
    method: 'POST',
    url: `${app.forum.attribute<string>('apiUrl')}/chat/direct`,
    body: { data: { attributes: { userIds } } },
  });

  const id = Number(payload?.data?.id);

  if (!id) return false;

  let channel: RamonChannel | null = null;

  if (payload?.meta?.serialized) {
    try {
      channel = app.store.pushPayload(payload) as unknown as RamonChannel;
    } catch {
      channel = null;
    }
  }

  if (!channel) channel = ((await app.store.find('chat-channels' as any, String(id)).catch(() => null)) as unknown as RamonChannel) || null;

  if (channel) state.rememberChannel(channel);
  if (payload?.meta?.created) state.seedEmptyChannel(id);

  openChannel(id);

  return true;
}

/** O ícone do canal do próprio ramon/chat (emoji, imagem ou os avatares da MD). */
export function ramonChannelIcon(channel: RamonChannel, className: string): Mithril.Children {
  type IconFn = (c: RamonChannel, cls: string) => Mithril.Children;

  // O registro guarda o módulo como a própria função quando ele só exporta
  // ela; com mais exportações, como objeto.
  const helper = ramonModule<IconFn | { channelIcon?: IconFn }>('forum/utils/channelIcon');
  const fn = typeof helper === 'function' ? helper : helper?.channelIcon;

  try {
    return fn ? fn(channel, className) : null;
  } catch {
    return null;
  }
}

/**
 * O "x" da MD na lista: sai da conversa pelo POST /leave do ramon/chat (o mesmo
 * da ação "Sair" dele) e a tira da lista. Devolve se saiu.
 */
export async function leaveDirect(channel: RamonChannel): Promise<boolean> {
  const state = chatState();

  try {
    await app.request({ method: 'POST', url: `${app.forum.attribute<string>('apiUrl')}/chat-channels/${channel.id()}/leave` });
  } catch (e: any) {
    app.alerts.show(
      { type: 'error' },
      e?.response?.errors?.[0]?.detail ?? (app.translator.trans('ramon-chat.forum.channel.leave_failed', {}, true) as string)
    );

    return false;
  }

  (channel as any).pushAttributes?.({ isFollowing: false, unreadCount: 0, unreadMentionsCount: 0 });

  if (state) {
    // Depois da animação de saída da linha.
    setTimeout(() => {
      state.channels = state.channels.filter((c) => c.id() !== channel.id());
      if (state.activeChannelId === Number(channel.id())) state.setActiveChannel(null);
      m.redraw();
    }, 250);
  }

  return true;
}
