/*
 * O cartão de usuário: abre no clique do avatar ou do nome do
 * autor, junto dele, com avatar grande, nomes, grupos, bio, "visto há…",
 * "membro desde" e os botões "Ver perfil"/"Mensagem". Fecha ao clicar fora,
 * com Esc ou ao navegar.
 *
 * Há um cartão só para a página inteira, montado num <div> próprio no body:
 * dentro do post ele seria cortado pelo overflow do conteúdo e ficaria preso
 * ao SubtreeRetainer, que não redesenha o post à toa.
 *
 * O cartão aparece inteiro: ele é montado escondido e só se mostra quando o
 * perfil completo (tempo de leitura, curtidas...), os emblemas e o avatar
 * chegaram. Antes, na primeira vez depois de carregar a página, ele abria
 * com o que o post trazia e ia crescendo e mudando com o que chegava.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import Separator from 'flarum/common/components/Separator';
import classList from 'flarum/common/utils/classList';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import UserControls from 'flarum/forum/utils/UserControls';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { fullDate, shortAge, shortDate } from '../../utils/dates';
import { t } from '../../utils/settings';
import { thirdParty } from '../../thirdparty/settings';
import { Bio, BirthdayFact, LocationFact, StatusLine, WebsiteFact, profileImageStyle, userTitle } from '../../features/profile';
import { AUTHOR_FILTER_MAX_POSTS, authorPostCount, filterByAuthor } from '../authorFilter';
import { FeaturedBadges } from '../../features/badges';
import { badgesEnabled, loadUserBadges } from '../../features/badges/utils';
import { userIcons } from '../../utils/userIcons';

/** Distância do cartão até o avatar e até as bordas da janela. */
const GAP = 8;
const EDGE = 16;

/** Quanto o cartão espera pelos dados antes de abrir com o que tiver (ms). */
const MAX_WAIT = 1200;

interface CardState {
  user: User;
  anchor: HTMLElement;
  /** Dados e avatar prontos: o cartão se mostra. */
  ready: boolean;
}

let state: CardState | null = null;
let root: HTMLElement | null = null;
const profiles = new Map<string, Promise<unknown>>();

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * O perfil completo e os emblemas, uma vez por sessão para cada pessoa. O
 * usuário que vem junto do post não traz as estatísticas (só a resposta do
 * perfil traz), e os emblemas vêm de outro pedido.
 */
export function prefetchUserCard(user: User): Promise<unknown> {
  const id = user.id();

  if (!id) return Promise.resolve();

  if (!profiles.has(id)) {
    profiles.set(
      id,
      Promise.all([app.store.find('users', id, {}, { errorHandler: () => {} }).catch(() => {}), badgesEnabled() ? loadUserBadges(user) : null])
    );
  }

  return profiles.get(id)!;
}

/** O avatar grande do cartão já baixado (ou falhou, ou não há foto). */
function avatarReady(): Promise<unknown> {
  const img = root?.querySelector<HTMLImageElement>('.CanelaUserCard-avatar img');

  if (!img || (img.complete && img.naturalWidth > 0)) return Promise.resolve();

  return img.decode().catch(() => {});
}

function onDocumentEvent(event: Event) {
  if (!state) return;

  if (event instanceof KeyboardEvent) {
    if (event.key === 'Escape') closeUserCard();
    return;
  }

  const target = event.target as Node;

  if (root?.contains(target) || state.anchor.contains(target)) return;

  closeUserCard();
}

function ensureRoot() {
  if (root) return;

  root = document.createElement('div');
  root.className = 'CanelaUserCardRoot';
  document.body.appendChild(root);

  m.mount(root, { view: () => (state ? <CanelaUserCard user={state.user} anchor={state.anchor} ready={state.ready} /> : null) });

  document.addEventListener('mousedown', onDocumentEvent, true);
  document.addEventListener('keydown', onDocumentEvent, true);
  window.addEventListener('popstate', () => closeUserCard());

  // Um modal aberto pelo cartão (o "Editar" do ⋯, conversar…) fica por cima
  // da página: o cartão fecha, em vez de ficar sobre o modal.
  extend('flarum/common/states/ModalManagerState' as any, 'show', () => closeUserCard());
}

export function openUserCard(user: User, anchor: HTMLElement): void {
  ensureRoot();

  // Um segundo clique no mesmo avatar fecha.
  if (state && state.user === user && state.anchor === anchor) {
    closeUserCard();
    return;
  }

  const current: CardState = { user, anchor, ready: false };

  state = current;

  // Montado já (escondido): o avatar começa a baixar enquanto os dados
  // chegam. Com tudo pronto, ou passado o limite, ele aparece de uma vez.
  m.redraw.sync();

  Promise.race([
    prefetchUserCard(user).then(() => {
      // O cartão com os dados novos, ainda escondido, antes de olhar o avatar.
      if (state === current) m.redraw.sync();

      return avatarReady();
    }),
    wait(MAX_WAIT),
  ]).then(() => {
    if (state !== current) return;

    current.ready = true;
    m.redraw();
  });
}

/** O tempo de leitura (segundos) no formato curto: "35 d", "13 h", "8 min". */
function readTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);

  if (minutes < 60) return app.translator.trans('ramon-canela.forum.age.minutes', { count: Math.max(1, minutes) }, true) as string;
  if (minutes < 60 * 24) return app.translator.trans('ramon-canela.forum.age.hours', { count: Math.round(minutes / 60) }, true) as string;

  return app.translator.trans('ramon-canela.forum.age.days', { count: Math.round(minutes / 60 / 24) }, true) as string;
}

export function closeUserCard(): void {
  if (!state) return;

  state = null;
  m.redraw();
}

interface CanelaUserCardAttrs extends ComponentAttrs {
  user: User;
  anchor: HTMLElement;
  ready: boolean;
}

class CanelaUserCard extends Component<CanelaUserCardAttrs> {
  /**
   * O cartão (39em): o avatar de 8em subindo 3.3em
   * acima do cartão, com o flair no canto; @nome enorme e, embaixo, o nome e
   * o título; à direita "Mensagem" e "N postagens no tópico"; depois a bio
   * (2 linhas), local e site, os metadados e os emblemas. O fundo é a imagem
   * de fundo do perfil, sob um véu da cor do cartão.
   */
  view() {
    const user = this.attrs.user;
    const groups = ((user.groups() || []) as any[]).filter((group) => group && !group.isHidden?.());
    const flairGroup = groups.find((group) => group.icon());
    const lastSeen = user.lastSeenAt();
    const joined = user.joinTime();
    const timeRead = user.attribute<number | null | undefined>('canelaTimeRead');
    const recentRead = user.attribute<number | null | undefined>('canelaRecentTimeRead');
    const likes = user.attribute<number | null | undefined>('canelaLikesReceived');
    const solutions = user.attribute<number | null | undefined>('bestAnswerCount');
    // Só o título do perfil: o grupo já está no flair do avatar.
    const title = userTitle(user);
    const showName = user.displayName() !== user.username();

    // A "Mensagem" do flarum/messages vira o botão primário; o resto dos
    // controles (moderação) vai para o "…".
    const controls = UserControls.controls(user, this);
    const message = controls.has('sendMessage') ? (controls.get('sendMessage') as any) : null;
    if (message) controls.remove('sendMessage');
    // O "Chat" do ramon/chat (abrir a MD com a pessoa) vira o botão ao lado da
    // "Mensagem".
    const chat = thirdParty.ramonChatUserButton() && controls.has('chatDirect') ? (controls.get('chatDirect') as any) : null;
    if (chat) controls.remove('chatDirect');
    const otherControls = controls.toArray().filter((item: any) => item && item.tag !== Separator);

    // "N postagens no tópico", quando o cartão abre de dentro de um tópico.
    const discussion = app.current.get('discussion');
    const stream = app.current.get('stream');
    const inTopic = discussion && stream ? authorPostCount(discussion, user) : 0;

    const facts = [LocationFact(user), WebsiteFact(user), BirthdayFact(user)].filter(Boolean);
    const meta1 = [
      lastSeen && !user.isOnline() && this.meta('seen', t('topic.user_card.last_seen'), shortAge(lastSeen), fullDate(lastSeen)),
      // Online: só "online agora", em verde (o "Visto" sobra).
      user.isOnline() && (
        <span className="CanelaUserCard-meta CanelaUserCard-online">
          <span className="CanelaUserCard-onlineNow">{t('user.stats.online')}</span>
        </span>
      ),
      joined && this.meta('joined', t('topic.user_card.joined'), shortDate(joined), fullDate(joined)),
      // "Lido 3 meses (1 d recentemente)": o tempo dos últimos 60 dias entre
      // parênteses.
      typeof timeRead === 'number' &&
        timeRead > 0 &&
        this.meta(
          'read',
          t('topic.user_card.read'),
          typeof recentRead === 'number' && recentRead > 0 && recentRead < timeRead
            ? `${readTime(timeRead)} (${t('topic.user_card.read_recently', { time: readTime(recentRead) })})`
            : readTime(timeRead)
        ),
    ].filter(Boolean);
    const meta2 = [
      typeof likes === 'number' && this.meta('likes', t('topic.user_card.likes_received'), abbreviateNumber(likes), undefined, true),
      typeof solutions === 'number' && solutions > 0 && this.meta('solutions', t('topic.user_card.solutions'), abbreviateNumber(solutions)),
    ].filter(Boolean);

    const status = StatusLine(user);
    const bio = Bio(user);

    return (
      <div
        className={classList('CanelaUserCard', {
          'CanelaUserCard--ready': this.attrs.ready,
          'CanelaProfile--hasCardBg': !!profileImageStyle(user)['--canela-user-card-bg'],
        })}
        aria-hidden={this.attrs.ready ? undefined : 'true'}
        role="dialog"
        aria-label={user.displayName()}
        style={{ '--usercard-color': user.color() || undefined, ...profileImageStyle(user) }}
      >
        <div className="CanelaUserCard-content">
          <div className="CanelaUserCard-first">
            <div className="CanelaUserCard-avatarWrapper">
              <Link className="CanelaUserCard-avatar" href={app.route.user(user)} onclick={closeUserCard}>
                <Avatar user={user} loading="eager" />
              </Link>
              {flairGroup && (
                <span className="CanelaUserCard-flair" title={flairGroup.nameSingular()} style={{ '--group-color': flairGroup.color() || undefined }}>
                  <Icon name={flairGroup.icon()} />
                </span>
              )}
            </div>

            <div className="CanelaUserCard-names">
              {/* O nome grande e, na mesma linha, os ícones (selo de verificado),
                  fora do link: o popover do selo funciona sem levar ao perfil.
                  O status fica só na pílula embaixo. */}
              <div className="CanelaUserCard-nameLine">
                <Link className="CanelaUserCard-name" href={app.route.user(user)} onclick={closeUserCard}>
                  <span className="CanelaUserCard-username">{user.displayName() || user.username()}</span>
                </Link>
                {userIcons(user, 'card')}
              </div>
              {/* O apelido (flarum/nicknames) em destaque, como nos posts; o username embaixo. */}
              {showName && <span className="CanelaUserCard-secondary">{user.username()}</span>}
              {title && <span className="CanelaUserCard-secondary CanelaUserCard-title">{title}</span>}
            </div>

            <div className="CanelaUserCard-controls">
              {chat && (
                <Button {...chat.attrs} className="Button CanelaUserCard-chat" icon="fas fa-comment-dots">
                  {t('chat.start_conversation')}
                </Button>
              )}
              {message && (
                <Button {...message.attrs} className="Button Button--primary CanelaUserCard-message" icon="far fa-envelope">
                  {message.children}
                </Button>
              )}
              {inTopic > 1 && discussion.postIds().length <= AUTHOR_FILTER_MAX_POSTS && (
                <Button
                  className="Button CanelaUserCard-filter"
                  icon="fas fa-filter"
                  onclick={() => {
                    closeUserCard();
                    filterByAuthor(stream, discussion, user);
                  }}
                >
                  {t('topic.user_card.posts_in_topic', { count: inTopic })}
                </Button>
              )}
              {otherControls.length > 0 && (
                <Dropdown
                  className="CanelaUserCard-more"
                  buttonClassName="Button Button--icon"
                  menuClassName="Dropdown-menu--right"
                  icon="fas fa-ellipsis-h"
                  caretIcon=""
                  label=""
                  helperText={null}
                  accessibleToggleLabel={t('topic.user_card.more')}
                >
                  {controls.toArray()}
                </Dropdown>
              )}
            </div>
          </div>

          {status && <div className="CanelaUserCard-row">{status}</div>}
          {bio && <div className="CanelaUserCard-row CanelaUserCard-bio">{bio}</div>}
          {facts.length > 0 && <div className="CanelaUserCard-row CanelaUserCard-facts">{dotted(facts)}</div>}
          {meta1.length > 0 && <div className="CanelaUserCard-row CanelaUserCard-metadata">{dotted(meta1)}</div>}
          {meta2.length > 0 && <div className="CanelaUserCard-row CanelaUserCard-metadata">{dotted(meta2)}</div>}
          <FeaturedBadges className="CanelaUserCard-row CanelaUserCard-badges" user={user} limit={3} />
        </div>
      </div>
    );
  }

  /** "Rótulo valor" dos metadados do cartão. */
  meta(key: string, label: string, value: string, title?: string, accent = false) {
    return (
      <span className={`CanelaUserCard-meta CanelaUserCard-meta--${key}`} title={title}>
        <span className="CanelaUserCard-metaLabel">{label}</span>{' '}
        <span className={classList('CanelaUserCard-metaValue', { 'CanelaUserCard-metaValue--accent': accent })}>{value}</span>
      </span>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<CanelaUserCardAttrs, this>) {
    super.oncreate(vnode);
    this.position();
  }

  onupdate(vnode: Mithril.VnodeDOM<CanelaUserCardAttrs, this>) {
    super.onupdate(vnode);
    this.position();
  }

  /**
   * Ao lado do avatar clicado; se não couber embaixo, em cima; e nunca fora
   * da janela. No celular o CSS o centraliza.
   */
  position() {
    const card = this.element as HTMLElement;
    const anchor = this.attrs.anchor;

    if (!anchor.isConnected) {
      closeUserCard();
      return;
    }

    if (app.screen() === 'phone') {
      card.style.left = '';
      card.style.top = '';
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;

    // O avatar grande do cartão (que sobe 3.3em acima dele,
    // pela margem do CSS) fica à direita do avatar clicado, quase na mesma
    // altura dele.
    let left = rect.right + GAP;
    let top = rect.top - 22;

    if (left + width > viewportWidth - EDGE) left = Math.max(EDGE, viewportWidth - width - EDGE);
    if (top + height > viewportHeight - EDGE && rect.top - GAP - height > EDGE) top = rect.top - GAP - height;

    card.style.left = `${left + window.scrollX}px`;
    card.style.top = `${top + window.scrollY}px`;
  }
}

/**
 * Intercala um "•" entre os itens. O separador é um elemento próprio, irmão dos
 * itens: como pseudo-elemento dentro de um item que é link, ele herdava o
 * sublinhado e o clique do link.
 */
function dotted(items: Mithril.Children[]): Mithril.Children[] {
  return items.flatMap((item, index) =>
    index === 0
      ? [item]
      : [
          <span className="CanelaUserCard-sep" aria-hidden="true">
            •
          </span>,
          item,
        ]
  );
}
