/*
 * As mensagens fixadas do ramon/chat (chave `pin_bar`):
 *
 * - A faixa do topo da conversa mostra a fixada do trecho à vista (a mais
 *   nova até a última mensagem visível), não sempre a mais nova: rolando a
 *   conversa, a faixa acompanha.
 * - Com várias, um indicador de segmentos à esquerda (até quatro à vista, que
 *   rolam junto) marca qual delas é. Clicar na faixa leva à fixada mostrada e
 *   já deixa a anterior na faixa (da mais antiga volta à mais nova): cliques
 *   seguidos percorrem todas. A escolha do clique vale até o leitor rolar.
 * - "Ver todas" (só com mais de uma: com uma, a faixa já é ela) abre o painel,
 *   com o ponto quando há fixada que o leitor não viu (`pin_indicator`).
 * - O "×" oculta a faixa só neste navegador, até chegar uma fixada mais nova.
 *   Oculta, o alfinete do cabeçalho do canal é o caminho para o painel (com a
 *   faixa à vista, ele sai: a faixa já leva ao painel).
 * - O painel lista na ordem da conversa, com "Fixada por …" em cima de cada
 *   uma (o alfinete nas não vistas), desafixar no hover e, no pé, ocultar ou
 *   mostrar a faixa. Clicar numa fixada leva a ela na conversa.
 * - Na linha da mensagem, a marca de fixada fica só no alfinete.
 *
 * Desligada a chave, valem a faixa e o painel do próprio ramon/chat.
 */
import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import { extend, override } from 'flarum/common/extend';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { apiUrl, chatState, childList, component, ct, feature, findByClass, isPhone, ramonModule, readLocal, writeLocal } from './flags';

/** Os modelos do ramon/chat (`chat-messages`), sem importar a classe dele. */
type Message = any;

/** O indicador: segmentos à vista, altura total, espaço entre eles e o degradê das pontas (px). */
const INDICATOR_WINDOW = 4;
const INDICATOR_HEIGHT = 30;
const SEGMENT_GAP = 2;
const INDICATOR_FADE = 8;

/** O `include` da lista do ramon/chat, mais quem fixou (para o "Fixada por …"). */
const INCLUDE = 'user,user.groups,replyTo,replyTo.user,uploads,thread,pinnedBy';

export function pinBarOn(): boolean {
  return feature('pin_bar');
}

// ─── A lista do canal ───────────────────────────────────────────────────────

interface PinsEntry {
  list: Message[];
  loaded: boolean;
  loading: Promise<void> | null;
  seq: number;
  /** O total do servidor para o qual a lista já foi buscada (não se busca de novo pelo mesmo). */
  total: number | null;
}

const entries = new Map<number, PinsEntry>();

function entryFor(channelId: number): PinsEntry {
  let entry = entries.get(channelId);

  if (!entry) {
    entry = { list: [], loaded: false, loading: null, seq: 0, total: null };
    entries.set(channelId, entry);
  }

  return entry;
}

const idOf = (message: Message): number => Number(message?.id?.()) || 0;

/** Sem a data (a fixada otimista, antes da resposta): a mais nova de todas. */
const pinnedAtOf = (message: Message): number => message?.pinnedAt?.()?.getTime?.() ?? Number.POSITIVE_INFINITY;

/**
 * As fixadas do canal, na ordem da conversa: a lista buscada, as da janela
 * carregada (fixar uma mensagem à vista entra na hora) e a prévia do ramon/chat
 * (a mais nova, que chega antes da lista). Os modelos são os do store, então
 * desafixar em qualquer lugar tira a fixada daqui também.
 */
export function pinsFor(channelId: number): Message[] {
  const state = chatState();
  const found = new Map<number, Message>();
  const add = (message: Message) => {
    const id = idOf(message);

    if (id > 0 && !found.has(id)) found.set(id, message);
  };

  entryFor(channelId).list.forEach(add);

  for (const message of state?.streams?.[channelId]?.messages ?? []) {
    if (message?.isPinned?.()) add(message);
  }

  const preview = state?.pinnedPreviews?.[channelId];

  if (preview) add(preview);

  return [...found.values()].filter((message) => message.isPinned?.() && !message.isDeleted?.()).sort((a, b) => idOf(a) - idOf(b));
}

/** Busca as fixadas do canal (uma por vez; a resposta antiga não sobrescreve a nova). */
export function refreshPins(channelId: number): Promise<void> {
  const entry = entryFor(channelId);

  if (entry.loading) return entry.loading;

  const seq = ++entry.seq;
  const state = chatState();

  entry.loading = Promise.resolve(
    app.store.find('chat-messages', {
      filter: { channel: channelId, pinned: true, includeThreadReplies: true },
      sort: '-pinnedAt',
      include: INCLUDE,
      page: { limit: 50 },
    } as any)
  )
    .then((results: any) => {
      if (seq !== entry.seq) return;

      const list: Message[] = Array.isArray(results) ? results : [];
      const total = results?.payload?.meta?.page?.total;

      entry.list = list;
      entry.total = typeof total === 'number' ? total : list.length;

      // A prévia e o total do ramon/chat em dia: a faixa dele (com a chave
      // desligada) e o cache dele ficam com a mesma resposta.
      if (state?.pinnedPreviews) state.pinnedPreviews[channelId] = list[0] ?? null;
      if (state?.pinnedTotals) state.pinnedTotals[channelId] = entry.total;
    })
    .catch(() => {
      // Sem a lista, fica o que já havia; e a prévia marcada como pedida, para
      // não pedir de novo a cada desenho.
      if (state?.pinnedPreviews && !(channelId in state.pinnedPreviews)) state.pinnedPreviews[channelId] = null;
    })
    .finally(() => {
      entry.loaded = true;
      entry.loading = null;
      m.redraw();
    });

  return entry.loading;
}

/**
 * Busca de novo quando a lista não dá conta: ainda não buscada, a prévia do
 * ramon/chat caiu (o tempo real viu fixar uma mensagem fora da janela) ou o
 * servidor conta mais fixadas do que a lista tem.
 */
function syncPins(channelId: number): void {
  const state = chatState();
  const entry = entryFor(channelId);

  if (entry.loading) return;

  if (!entry.loaded) {
    refreshPins(channelId);
    return;
  }

  const invalidated = !!state?.pinnedPreviews && !(channelId in state.pinnedPreviews);
  const total = state?.pinnedTotals?.[channelId];
  const behind = typeof total === 'number' && total !== entry.total && total > pinsFor(channelId).length;

  if (invalidated || behind) refreshPins(channelId);
}

// ─── Ocultar a faixa e fixadas não vistas (por navegador) ───────────────────

function dismissedAt(channelId: number): number | null {
  const value = readLocal<Record<string, number>>('pinsDismissed', {})[channelId];

  return typeof value === 'number' ? value : null;
}

function setDismissed(channelId: number, value: number | null): void {
  const all = readLocal<Record<string, number>>('pinsDismissed', {});

  if (value === null) delete all[channelId];
  else all[channelId] = value;

  writeLocal('pinsDismissed', all);
}

function newestPinnedAt(pins: Message[]): number {
  return pins.reduce((newest, pin) => Math.max(newest, pinnedAtOf(pin)), 0);
}

/** A faixa está oculta neste navegador; uma fixada mais nova que a ocultação a traz de volta. */
export function barDismissed(channelId: number, pins: Message[] = pinsFor(channelId)): boolean {
  const at = dismissedAt(channelId);

  if (at === null || pins.length === 0) return false;

  if (newestPinnedAt(pins) > at) {
    setDismissed(channelId, null);
    return false;
  }

  return true;
}

function dismissBar(channelId: number, pins: Message[]): void {
  const newest = newestPinnedAt(pins);

  setDismissed(channelId, Number.isFinite(newest) ? newest : Date.now());
}

function viewedAt(channelId: number): number | null {
  const value = readLocal<Record<string, number>>('pinsViewedAt', {})[channelId];

  return typeof value === 'number' ? value : null;
}

/** O painel aberto (e fechado) conta como ver todas as fixadas do canal. */
function markPinsViewed(channelId: number): void {
  const all = readLocal<Record<string, number>>('pinsViewedAt', {});

  all[channelId] = Date.now();
  writeLocal('pinsViewedAt', all);
}

/** Quem fixou, quando a resposta trouxe (o `include` de `pinnedBy`). */
function pinnedBy(message: Message): any {
  const ref = message?.data?.relationships?.pinnedBy?.data;

  return ref ? app.store.getById('users', ref.id) : null;
}

function pinnedByMe(message: Message): boolean {
  const by = pinnedBy(message);

  return !!by && !!app.session.user && by.id() === app.session.user.id();
}

/**
 * Fixada que o leitor não viu: de outra pessoa e depois da última vez que ele
 * abriu o painel. A marca antiga (`pinsSeen`, a última fixada aberta, por id)
 * ainda conta, para quem já tinha visto antes desta versão.
 */
function isUnseen(pin: Message, channelId: number, since: number | null): boolean {
  if (pinnedByMe(pin)) return false;

  const legacy = readLocal<Record<string, number>>('pinsSeen', {})[channelId] || 0;

  if (idOf(pin) <= legacy) return false;

  return since === null || pinnedAtOf(pin) > since;
}

function hasUnseenPins(channelId: number, pins: Message[]): boolean {
  if (!feature('pin_indicator')) return false;

  const since = viewedAt(channelId);

  return pins.some((pin) => isUnseen(pin, channelId, since));
}

// ─── A fixada do trecho à vista ─────────────────────────────────────────────

/** A última mensagem à vista, por canal (`null`: no fim da conversa, ou ainda sem medida). */
const bottomIds = new Map<number, number | null>();

/** A fixada que o clique pôs na faixa, até o leitor rolar a conversa. */
const tapped = new Map<number, number>();

/** O que a faixa desenhou por último: a rolagem só redesenha quando muda. */
const shown = new Map<number, number | null>();

/** Por área de rolagem: houve gesto do leitor desde o último pulo do programa. */
const scrollers = new WeakMap<HTMLElement, { userScrolled: boolean }>();

/** A última linha com o topo acima do pé da área à vista (as linhas estão em ordem: busca binária). */
function bottomVisibleId(scroller: HTMLElement): number | null {
  const rows = scroller.querySelectorAll<HTMLElement>('.ChatMessage[data-id]');

  if (rows.length === 0) return null;

  const bottom = scroller.getBoundingClientRect().bottom;
  let low = 0;
  let high = rows.length - 1;
  let found = -1;

  while (low <= high) {
    const middle = (low + high) >> 1;

    if (rows[middle].getBoundingClientRect().top < bottom) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  const id = found >= 0 ? Number(rows[found].dataset.id) : 0;

  return id > 0 ? id : null;
}

function currentPin(channelId: number, pins: Message[]): Message | null {
  if (pins.length === 0) return null;

  const tappedId = tapped.get(channelId);

  if (tappedId !== undefined) {
    const pin = pins.find((candidate) => idOf(candidate) === tappedId);

    if (pin) return pin;
  }

  const bottomId = bottomIds.get(channelId);

  if (bottomId == null) return pins[pins.length - 1];

  let active = pins[0];

  for (const pin of pins) {
    if (idOf(pin) > bottomId) break;
    active = pin;
  }

  return active;
}

/**
 * Acompanha a rolagem da conversa. Num quadro só por rolagem, e o desenho só
 * quando a fixada da faixa muda. A escolha do clique cai no primeiro gesto do
 * leitor (roda, toque, clique, tecla), não na rolagem do próprio pulo.
 */
function watchScroller(view: any, scroller: HTMLElement | null): void {
  if (!scroller || scrollers.has(scroller)) return;

  const flags = { userScrolled: false };
  let frame = 0;

  scrollers.set(scroller, flags);

  const mark = () => {
    flags.userScrolled = true;
  };

  ['wheel', 'touchmove', 'pointerdown', 'keydown'].forEach((type) => scroller.addEventListener(type, mark, { passive: true }));

  scroller.addEventListener(
    'scroll',
    () => {
      if (frame) return;

      frame = requestAnimationFrame(() => {
        frame = 0;

        const channelId = Number(view.attrs?.channel?.id?.());

        if (!pinBarOn() || !channelId) return;

        // `pinned` é o "no fim da conversa" do próprio ChannelView.
        bottomIds.set(channelId, view.pinned ? null : bottomVisibleId(scroller));

        if (flags.userScrolled) {
          flags.userScrolled = false;
          tapped.delete(channelId);
        }

        const pins = pinsFor(channelId);

        if (pins.length < 2) return;

        const pin = currentPin(channelId, pins);

        if (shown.get(channelId) !== (pin ? idOf(pin) : null)) m.redraw();
      });
    },
    { passive: true }
  );
}

/**
 * Leva à fixada na conversa (carregando o trecho entre ela e a janela). Fora
 * da conversa (uma resposta de tópico), abre o tópico; sem tópico, o painel.
 */
function jumpTo(channelId: number, pin: Message, embedded: boolean): void {
  const state = chatState();
  const jump = ramonModule<{ revealAndJump?: (...args: any[]) => Promise<boolean> }>('forum/utils/jumpToMessage');
  const scroller = document.querySelector<HTMLElement>('.ChatChannel-stream');

  if (!state || !jump?.revealAndJump) return;

  const flags = scroller ? scrollers.get(scroller) : null;

  if (flags) flags.userScrolled = false;

  jump.revealAndJump(state, channelId, idOf(pin), scroller).then((found: boolean) => {
    if (found) return;

    const threadId = pin.threadId?.();

    if (threadId) {
      state.activeThreadId = Number(threadId);

      if (!embedded) m.route.set(app.route('chat.thread', { id: channelId, threadId }));
    } else if (!state.showPinned) {
      state.togglePinned();
    }

    m.redraw();
  });
}

// ─── A faixa ────────────────────────────────────────────────────────────────

function excerpt(pin: Message): string {
  const preview = ramonModule<{ messagePreview?: (message: Message, limit?: number) => string }>('common/utils/preview');
  const text = preview?.messagePreview?.(pin, 140) ?? String(pin.content?.() ?? '');

  return text || (app.translator.trans('ramon-chat.forum.message.pinned', {}, true) as string);
}

function indicatorStyle(total: number, index: number): Record<string, string> {
  const visible = Math.min(total, INDICATOR_WINDOW);
  const segment = Math.floor((INDICATOR_HEIGHT - SEGMENT_GAP * (visible - 1)) / visible);
  const height = segment * visible + SEGMENT_GAP * (visible - 1);
  const top = total <= INDICATOR_WINDOW ? 0 : Math.max(0, Math.min(index - Math.floor(INDICATOR_WINDOW / 2), total - INDICATOR_WINDOW));

  return {
    '--cn-pin-seg': `${segment}px`,
    '--cn-pin-gap': `${SEGMENT_GAP}px`,
    '--cn-pin-height': `${height}px`,
    '--cn-pin-top': String(top),
    '--cn-pin-active': String(index),
    '--cn-pin-fade-top': `${top > 0 ? INDICATOR_FADE : 0}px`,
    '--cn-pin-fade-bottom': `${top < total - visible ? INDICATOR_FADE : 0}px`,
  };
}

function pinnedBar(view: any, channelId: number, pins: Message[]): Mithril.Children {
  const state = chatState();
  const pin = currentPin(channelId, pins)!;
  const index = Math.max(0, pins.indexOf(pin));
  const multiple = pins.length > 1;
  const panelOpen = !!state?.showPinned;
  const allLabel = panelOpen ? ct('pinned_messages.close') : ct('pinned_messages.title');
  const dismissLabel = ct('pinned_messages.dismiss');

  shown.set(channelId, idOf(pin));

  const onJump = () => {
    const ordered = pinsFor(channelId);
    const current = currentPin(channelId, ordered);

    if (!current) return;

    jumpTo(channelId, current, !!view.attrs.embedded);

    // A próxima da faixa: a anterior a esta (da mais antiga, volta à mais nova).
    const at = ordered.indexOf(current);
    const next = at <= 0 ? ordered[ordered.length - 1] : ordered[at - 1];

    tapped.set(channelId, idOf(next));
  };

  return (
    <div className={classList('ChatChannel-pinnedBar CanelaPinnedBar', { 'CanelaPinnedBar--multiple': multiple })}>
      <div className="CanelaPinnedBar-main">
        <button type="button" className="CanelaPinnedBar-jump" aria-label={ct('pinned_bar.jump_to_pinned')} onclick={onJump} />

        {multiple ? (
          <span className="CanelaPinnedBar-indicator" aria-hidden="true" style={indicatorStyle(pins.length, index)}>
            <span className="CanelaPinnedBar-track">
              {pins.map(() => (
                <span className="CanelaPinnedBar-segment" />
              ))}
              <span className="CanelaPinnedBar-thumb" />
            </span>
          </span>
        ) : null}

        <span className="CanelaPinnedBar-content">
          <span className="CanelaPinnedBar-label">
            <Icon name="fas fa-thumbtack" />
            {ct('pinned_bar.title')}
          </span>
          <span className="CanelaPinnedBar-excerpt">{excerpt(pin)}</span>
        </span>
      </div>

      {multiple ? (
        <button
          type="button"
          className={classList('Button Button--icon Button--flat CanelaPinnedBar-all', { 'CanelaPinnedBar-all--active': panelOpen })}
          title={allLabel}
          aria-label={allLabel}
          aria-pressed={panelOpen ? 'true' : 'false'}
          onclick={() => {
            state?.togglePinned();
            m.redraw();
          }}
        >
          <Icon name="fas fa-list" />
          {hasUnseenPins(channelId, pins) ? <span className="CanelaPinnedBar-dot" /> : null}
        </button>
      ) : null}

      <Button
        className="Button Button--icon Button--flat CanelaPinnedBar-dismiss"
        icon="fas fa-xmark"
        title={dismissLabel}
        aria-label={dismissLabel}
        onclick={() => {
          dismissBar(channelId, pins);
          m.redraw();
        }}
      />
    </div>
  );
}

// ─── O painel ───────────────────────────────────────────────────────────────

async function unpin(pin: Message): Promise<void> {
  pin.pushAttributes({ isPinned: false });
  m.redraw();

  try {
    const payload = await app.request<any>({
      method: 'POST',
      url: apiUrl(`/chat-messages/${pin.id()}/pin`),
      body: { data: { attributes: {} } },
      errorHandler: () => {},
    } as any);

    app.store.pushPayload(payload);
  } catch (e: any) {
    pin.pushAttributes({ isPinned: true });
    app.alerts.show({ type: 'error' }, e?.response?.errors?.[0]?.detail ?? app.translator.trans('ramon-chat.forum.message.pin_failed'));
  }

  m.redraw();
}

/** Abre a fixada na conversa; na gaveta e no celular o painel cobre a conversa, então fecha antes. */
function openPin(panel: any, pin: Message): void {
  const { state, embedded, onClose } = panel.attrs;
  const channelId = Number(panel.attrs.channel.id());

  tapped.set(channelId, idOf(pin));

  if (embedded || isPhone()) {
    state.showPinned = false;
    onClose?.();
    m.redraw.sync();
  }

  jumpTo(channelId, pin, !!embedded);
}

function pinnedByText(pin: Message): string {
  if (pinnedByMe(pin)) return ct('pinned_messages.pinned_by_you');

  const by = pinnedBy(pin);

  return by ? ct('pinned_messages.pinned_by_user', { username: by.displayName() }) : ct('pinned');
}

function pinnedPanel(panel: any): Mithril.Children {
  const { channel, state, onClose } = panel.attrs;
  const channelId = Number(channel.id());

  // Ao abrir (e ao trocar de canal com ele aberto): a última visita fica como
  // estava para marcar as não vistas desta vez, e o painel já conta como visto.
  if (panel.canelaChannel !== channelId) {
    panel.canelaChannel = channelId;
    panel.canelaSince = viewedAt(channelId);
    markPinsViewed(channelId);
  }

  const pins = pinsFor(channelId);
  const ChatMessage = ramonModule('forum/components/ChatMessage');
  const skeleton = ramonModule<{ MessageStreamSkeleton?: (rows: number) => Mithril.Children }>('forum/components/Skeletons');
  const loading = panel.loading && pins.length === 0;
  const dismissed = barDismissed(channelId, pins);
  const closeLabel = ct('pinned_messages.close');
  const unpinLabel = ct('unpin_message');

  return (
    <div className="ChatThreadPanel ChatPinnedPanel CanelaPinnedPanel">
      <div className="ChatThreadPanel-header">
        <Icon name="fas fa-thumbtack" />
        <span className="ChatThreadPanel-title">{ct('pinned_messages.title')}</span>
        <Button className="Button Button--icon Button--flat" icon="fas fa-xmark" title={closeLabel} aria-label={closeLabel} onclick={onClose} />
      </div>

      <div className="ChatThreadPanel-stream CanelaPinnedPanel-list">
        {loading ? (skeleton?.MessageStreamSkeleton?.(3) ?? <LoadingIndicator />) : null}

        {!loading && pins.length === 0 ? <div className="ChatBrowse-empty CanelaPinnedPanel-empty">{ct('no_pinned_messages')}</div> : null}

        {pins.map((pin) => {
          const unseen = isUnseen(pin, channelId, panel.canelaSince ?? null);

          return (
            <div key={pin.id()} className={classList('CanelaPinnedItem', { 'CanelaPinnedItem--unseen': unseen })}>
              {/* O clique na linha toda leva à mensagem; os links dela continuam clicáveis (CSS). */}
              <button
                type="button"
                className="CanelaPinnedItem-jump"
                aria-label={ct('pinned_bar.jump_to_pinned')}
                onclick={() => openPin(panel, pin)}
              />

              <div className="CanelaPinnedItem-body">
                <div className="CanelaPinnedItem-by">
                  {unseen ? <Icon name="fas fa-thumbtack" /> : null}
                  <span>{pinnedByText(pin)}</span>
                </div>

                {ChatMessage ? <ChatMessage message={pin} previous={null} state={state} hideThreadIndicator /> : null}
              </div>

              {pin.canPin?.() ? (
                <Button
                  className="Button Button--icon Button--flat CanelaPinnedItem-unpin"
                  icon="fas fa-thumbtack-slash"
                  title={unpinLabel}
                  aria-label={unpinLabel}
                  onclick={() => unpin(pin)}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {pins.length > 0 ? (
        <div className="CanelaPinnedPanel-footer">
          <Button
            className="Button Button--flat CanelaPinnedPanel-toggleBar"
            onclick={() => {
              if (dismissed) setDismissed(channelId, null);
              else dismissBar(channelId, pins);

              state.showPinned = false;
              onClose?.();
              m.redraw();
            }}
          >
            {dismissed ? ct('pinned_messages.show') : ct('pinned_messages.dismiss')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function installPins(): void {
  override(component('ChannelView'), 'pinnedBar', function (this: any, original: () => Mithril.Children) {
    if (!pinBarOn()) return original();

    const channelId = Number(this.attrs.channel.id());

    syncPins(channelId);

    const pins = pinsFor(channelId);

    if (pins.length === 0 || barDismissed(channelId, pins)) {
      shown.delete(channelId);
      return null;
    }

    return pinnedBar(this, channelId, pins);
  });

  // O alfinete do cabeçalho: só com a faixa oculta (ou o painel aberto, para fechá-lo).
  extend(component('ChannelView'), 'header', function (this: any, vnode: any) {
    if (!vnode || !pinBarOn()) return;

    const actions = findByClass(vnode, 'ChatChannel-headerActions');

    if (!actions) return;

    const channelId = Number(this.attrs.channel.id());
    const pins = pinsFor(channelId);

    if (chatState()?.showPinned || (pins.length > 0 && barDismissed(channelId, pins))) return;

    const children = childList(actions);
    const at = children.findIndex((child: any) => child && typeof child === 'object' && child.key === 'pinned');

    if (at >= 0) children.splice(at, 1);
  });

  extend(component('ChannelView'), 'oncreate', function (this: any) {
    watchScroller(this, this.scroller);
  });

  override(component('PinnedPanel'), 'load', function (this: any, original: () => Promise<void>) {
    if (!pinBarOn()) return original();

    const channelId = Number(this.attrs.channel.id());

    this.loading = !entryFor(channelId).loaded;

    return refreshPins(channelId).finally(() => {
      this.loading = false;
    });
  });

  override(component('PinnedPanel'), 'view', function (this: any, original: () => Mithril.Children) {
    return pinBarOn() ? pinnedPanel(this) : original();
  });

  extend(component('PinnedPanel'), 'onremove', function (this: any) {
    const channelId = Number(this.attrs?.channel?.id?.());

    if (pinBarOn() && channelId) markPinsViewed(channelId);
  });

  // Na linha da mensagem, a marca de fixada é só o alfinete (com o nome no title).
  extend(component('ChatMessage'), 'view', function (vnode: any) {
    if (!pinBarOn()) return;

    const mark = findByClass(vnode, 'ChatMessage-pinMark');

    if (!mark) return;

    const label = ct('pinned');

    mark.children = childList(mark).filter((child: any) => child && typeof child === 'object' && child.tag !== '#' && child.tag !== '[');
    mark.attrs.title = label;
    mark.attrs['aria-label'] = label;
  });
}
