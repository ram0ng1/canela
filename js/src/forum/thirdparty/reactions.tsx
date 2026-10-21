/*
 * fof/reactions no jeito do Canela.
 *
 * Com a barra de ações do tema e o flarum/likes ligados, curtida e reações
 * viram um botão só:
 *
 * - O coração da barra: clicar curte (ou desfaz); passar o mouse (ou o toque
 *   longo, no celular) abre acima o seletor com as reações habilitadas do
 *   fof/reactions, na ordem dele. A reação "heart" do fof, onde estiver na
 *   lista, é a curtida do flarum/likes; as outras são reações do fof. Cada
 *   pessoa tem uma reação por post: escolher um emoji estando curtido
 *   descurte, e escolher o coração estando com um emoji remove a reação.
 *   Depois de reagir, o botão mostra o emoji escolhido; clicar nele desfaz.
 * - À esquerda, um contador só: até três emojis (os mais usados primeiro, o
 *   coração das curtidas incluso) sobrepostos e o total. O clique abre quem
 *   reagiu, cada pessoa com o seu emoji.
 *
 * Sem a barra do tema ou sem o flarum/likes, o botão de reagir do fof continua
 * (com o mesmo seletor em grade) e o resumo vem ao lado das curtidas.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import CommentPost from 'flarum/forum/components/CommentPost';
import PostControls from 'flarum/forum/utils/PostControls';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import haptic from 'flarum/common/utils/haptic';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { isExtensionEnabled, t } from '../utils/settings';
import { extModule, thirdParty } from './settings';
import { postUi, topicSettings, type PostUi } from '../topic/ui';
import { likers } from '../topic/posts';
import { heartIcon, openWhoReacted, type ReactorEntry } from '../topic/components/WhoReactedPopover';

/** Quantos emojis o resumo mostra. */
const SUMMARY_EMOJIS = 3;

/** A reação do fof que é a curtida do flarum/likes. */
const HEART = 'heart';

/** Atrasos: abrir no hover, fechar ao sair, toque longo. */
const OPEN_DELAY = 250;
const CLOSE_DELAY = 300;
const LONG_PRESS = 400;

/** Distância mínima do seletor às bordas da janela. */
const EDGE = 8;

function reactionComponent(): any {
  return extModule<any>('fof-reactions', 'common/components/ReactionComponent');
}

function reactToPostFn(): ((post: Post, reaction: any, loading: Record<string, boolean>) => unknown) | null {
  const mod = extModule<any>('fof-reactions', 'forum/utils/reactToPost');

  return mod ? mod.default || mod : null;
}

/**
 * As reações habilitadas do fof/reactions, na ordem dele (a que o admin do
 * fof gerencia): o seletor dos posts e o das mensagens usam esta lista.
 */
export function enabledReactions(): any[] {
  const fromForum = (app.forum as any)?.reactions?.();
  const list: any[] = Array.isArray(fromForum) && fromForum.length ? fromForum : (app.store.all('reactions') as any[]);

  return list.filter((reaction) => reaction && reaction.enabled?.() !== false);
}

function heartReaction(): any {
  return (app.store.all('reactions') as any[]).find((reaction) => reaction.identifier?.() === HEART) || null;
}

/** O ❤️ das curtidas: o emoji do fof, para ficar igual aos outros; sem ele, o ícone. */
function heartEmoji(): Mithril.Children {
  const ReactionComponent = reactionComponent();
  const heart = heartReaction();

  return ReactionComponent && heart ? m(ReactionComponent, { reaction: heart }) : heartIcon();
}

function reactionEmoji(reaction: any): Mithril.Children {
  const ReactionComponent = reactionComponent();

  return ReactionComponent && reaction ? m(ReactionComponent, { reaction }) : null;
}

function reactionLabel(reaction: any): string {
  return String(reaction?.display?.() || reaction?.identifier?.() || '');
}

function counts(post: Post): Array<[string, number]> {
  const raw: Record<string, number> = (post as any).reactionCounts?.() || {};

  return Object.keys(raw)
    .map((id) => [id, Number(raw[id]) || 0] as [string, number])
    .filter(([id, count]) => count > 0 && !!app.store.getById('reactions', id))
    .sort((a, b) => b[1] - a[1]);
}

/** A unificação vale com a barra do tema e as duas extensões. */
function unified(): boolean {
  return thirdParty.reactions() && topicSettings.postActions() && isExtensionEnabled('flarum-likes');
}

function isLiked(post: Post): boolean {
  const user = app.session.user;

  return !!user && ((post as any).likes?.() || []).some((liker: any) => liker === user);
}

/** A reação do fof do leitor neste post (a "heart" conta como curtida). */
function myReaction(post: Post): any {
  const id = (post as any).userReaction?.();
  const counted = id && Number(((post as any).reactionCounts?.() || {})[id]) > 0;

  return counted ? app.store.getById('reactions', String(id)) || null : null;
}

/**
 * Curtir/descurtir como o flarum/likes faz, mas devolvendo a promessa (para
 * trocar a curtida por um emoji em sequência) e já mexendo na contagem.
 */
function setLiked(post: Post, value: boolean): Promise<unknown> {
  const user = app.session.user!;
  const data: any = post.data;
  const relationships = (data.relationships ??= {});
  const likes = (relationships.likes ??= { data: [] }).data as Array<{ type: string; id: string }>;
  const index = likes.findIndex((like) => like.id === user.id());
  const count = Number(post.attribute('likesCount')) || 0;

  if (index !== -1) likes.splice(index, 1);
  if (value) likes.unshift({ type: 'users', id: user.id()! });
  if (value) haptic('success');

  // Muda a "frescura" do post: o SubtreeRetainer redesenha na hora.
  post.pushAttributes({ likesCount: Math.max(0, count + (value ? 1 : -1)) } as any);
  m.redraw();

  return post.save({ isLiked: value } as any).catch(() => {});
}

// ---------------------------------------------------------------------------
// Quem reagiu
// ---------------------------------------------------------------------------

/** O id de uma relação (ou do atributo) do PostReaction do fof. */
function relatedId(item: any, relation: string, attribute: string): string | null {
  const id = item?.data?.relationships?.[relation]?.data?.id ?? item?.attribute?.(attribute);

  return id === null || id === undefined ? null : String(id);
}

/**
 * Quem reagiu com emoji. O modelo PostReaction do fof 2.x não resolve as
 * relações (`user()` devolve o getter, `reaction()` lê um atributo que não
 * existe): o usuário e a reação vêm pelos ids, já incluídos na resposta.
 */
function reactors(post: Post): Promise<ReactorEntry[]> {
  return app.store
    .find<any[]>('post_reactions', { filter: { post: post.id()! }, include: 'user,reaction', page: { limit: 50 } } as any, undefined, {
      errorHandler: () => {},
    })
    .then((list) =>
      Array.from(list || [])
        .map((item: any) => {
          const userId = relatedId(item, 'user', 'userId');
          const reactionId = relatedId(item, 'reaction', 'reactionId');

          return {
            user: userId ? app.store.getById<any>('users', userId) : null,
            reaction: reactionId ? app.store.getById('reactions', reactionId) : null,
          };
        })
        .filter((entry) => entry.user && entry.reaction)
        .map((entry) => ({ user: entry.user, icon: reactionEmoji(entry.reaction) }))
    );
}

/** Curtidores (com o ❤️) e quem reagiu com emoji, num popover só. */
function everyone(post: Post, canSeeReactions: boolean): Promise<ReactorEntry[]> {
  const likes = likers(post)
    .then((entries) => entries.map((entry) => ({ ...entry, icon: heartEmoji() })))
    .catch(() => [] as ReactorEntry[]);
  const others = canSeeReactions ? reactors(post).catch(() => [] as ReactorEntry[]) : Promise.resolve([] as ReactorEntry[]);

  return Promise.all([likes, others]).then(([a, b]) => a.concat(b));
}

// ---------------------------------------------------------------------------
// O resumo da esquerda
// ---------------------------------------------------------------------------

interface SummaryEntry {
  key: string;
  count: number;
  icon: Mithril.Children;
}

function summaryButton(post: Post, entries: SummaryEntry[], onclick: ((event: MouseEvent) => void) | null): Mithril.Children {
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const label = t('thirdparty.reactions.summary', { count: total });

  const body = [
    <span className="CanelaReactions-list">
      {entries.slice(0, SUMMARY_EMOJIS).map((entry) => (
        <span className="CanelaReactions-emoji">{entry.icon}</span>
      ))}
    </span>,
    <span className="CanelaReactions-count">{abbreviateNumber(total)}</span>,
  ];

  return onclick ? (
    <Button
      className="Button Button--flat CanelaPostAction CanelaReactions"
      aria-haspopup="dialog"
      aria-label={label}
      title={label}
      onclick={onclick}
    >
      {body}
    </Button>
  ) : (
    <span className="CanelaReactions CanelaReactions--static" aria-label={label} title={label}>
      {body}
    </span>
  );
}

function unifiedSummary(post: Post): Mithril.Children {
  const heart = heartReaction();
  const heartId = heart ? String(heart.id()) : null;
  const likeCount = Number(post.attribute('likesCount')) || ((post as any).likes?.() || []).length;
  let hearts = likeCount;
  const entries: SummaryEntry[] = [];

  counts(post).forEach(([id, count]) => {
    if (id === heartId) hearts += count;
    else entries.push({ key: id, count, icon: reactionEmoji(app.store.getById('reactions', id)) });
  });

  if (hearts > 0) entries.push({ key: HEART, count: hearts, icon: heartEmoji() });

  if (!entries.length) return null;

  // Os mais usados primeiro; no empate, o coração na frente.
  entries.sort((a, b) => b.count - a.count || (a.key === HEART ? -1 : b.key === HEART ? 1 : 0));

  const canSee = !!(post.discussion() as any)?.canSeeReactions?.();

  // Sem permissão para ver quem reagiu e sem curtidas (que são públicas), a
  // lista viria vazia: o resumo fica só como contagem, sem abrir nada.
  if (!canSee && likeCount === 0) return summaryButton(post, entries, null);

  return summaryButton(post, entries, (event) => openWhoReacted(event.currentTarget as HTMLElement, () => everyone(post, canSee)));
}

// ---------------------------------------------------------------------------
// O botão do coração com o seletor
// ---------------------------------------------------------------------------

interface Choice {
  key: string;
  label: string;
  icon: Mithril.Children;
  used: boolean;
  reaction: any;
}

function choices(post: Post): Choice[] {
  if (!app.session.user) return [];

  const canLike = !!(post as any).canLike?.();
  const canReact = !!(post as any).canReact?.();
  const mine = myReaction(post);
  const liked = isLiked(post);
  const list: Choice[] = [];
  let heartAdded = false;

  const addHeart = () => {
    if (heartAdded || !canLike) return;

    heartAdded = true;
    list.push({
      key: HEART,
      label: t('thirdparty.reactions.like_reaction'),
      icon: heartEmoji(),
      used: liked && (!mine || mine.identifier?.() === HEART),
      reaction: null,
    });
  };

  enabledReactions().forEach((reaction) => {
    if (reaction.identifier?.() === HEART) return addHeart();
    if (!canReact) return;

    list.push({
      key: String(reaction.id()),
      label: reactionLabel(reaction),
      icon: reactionEmoji(reaction),
      used: !!mine && mine === reaction,
      reaction,
    });
  });

  // Sem a "heart" habilitada no fof, a curtida vem na frente.
  if (!heartAdded && canLike) {
    addHeart();
    list.unshift(list.pop()!);
  }

  return list;
}

interface ReactButtonAttrs {
  post: Post;
  ui: PostUi;
}

class CanelaReactButton {
  open = false;
  element: HTMLElement | null = null;
  hoverTimer = 0;
  pressTimer = 0;
  suppressClick = false;
  loading: Record<string, boolean> = {};
  attrs!: ReactButtonAttrs;

  onDocument = (event: Event) => {
    if (!this.open || !this.element) return;

    if (event instanceof KeyboardEvent) {
      if (event.key === 'Escape') {
        this.setOpen(false);
        (this.element.querySelector('.CanelaReact-button') as HTMLElement | null)?.focus();
      }

      return;
    }

    if (!this.element.contains(event.target as Node)) this.setOpen(false);
  };

  view(vnode: Mithril.Vnode<ReactButtonAttrs, this>) {
    this.attrs = vnode.attrs;

    const { post, ui } = vnode.attrs;
    const guest = !app.session.user;
    const mine = myReaction(post);
    const emojiMine = mine && mine.identifier?.() !== HEART ? mine : null;
    const liked = isLiked(post) || (!!mine && !emojiMine);
    // Só o coração (sem permissão de reagir, p.ex. no próprio post): o botão
    // já curte sozinho, então não há seletor.
    const all = choices(post);
    const list = all.length === 1 && all[0].key === HEART ? [] : all;
    const label = guest
      ? t('topic.post.like_guest')
      : emojiMine
        ? t('thirdparty.reactions.remove')
        : t(liked ? 'topic.post.unlike' : 'topic.post.like');

    return (
      <div
        className={classList('CanelaReact', { 'is-open': this.open, 'has-reacted': liked || !!emojiMine, 'has-picker': list.length > 0 })}
        onpointerenter={(event: PointerEvent) => this.hover(event, true)}
        onpointerleave={(event: PointerEvent) => this.hover(event, false)}
        onfocusout={(event: FocusEvent) => {
          if (this.element && !this.element.contains(event.relatedTarget as Node)) this.setOpen(false);
        }}
      >
        <Button
          className={classList('Button Button--flat CanelaPostAction CanelaReact-button', {
            'Button--icon CanelaLike-toggle': !emojiMine,
            'CanelaLike--liked': !emojiMine && liked,
            'CanelaLike--bump': !emojiMine && liked && ui.likeBump && Date.now() - ui.likeBump < 1000,
            'CanelaReact-button--emoji': !!emojiMine,
          })}
          icon={emojiMine ? undefined : liked ? 'fas fa-heart' : 'far fa-heart'}
          aria-label={label}
          aria-pressed={liked || emojiMine ? 'true' : 'false'}
          aria-haspopup={list.length ? 'menu' : undefined}
          aria-expanded={list.length ? (this.open ? 'true' : 'false') : undefined}
          title={label}
          loading={!!this.loading[null as any]}
          onpointerdown={(event: PointerEvent) => this.press(event)}
          onpointerup={() => window.clearTimeout(this.pressTimer)}
          onpointercancel={() => window.clearTimeout(this.pressTimer)}
          oncontextmenu={(event: Event) => {
            if (this.open) event.preventDefault();
          }}
          onkeydown={(event: KeyboardEvent) => {
            if (event.key !== 'ArrowUp' || !list.length) return;

            event.preventDefault();
            this.setOpen(true);
            (this.element?.querySelector('.CanelaReactPicker-item') as HTMLElement | null)?.focus();
          }}
          onclick={() => this.main()}
        >
          {emojiMine ? reactionEmoji(emojiMine) : null}
        </Button>
        {list.length ? (
          <div className="CanelaReactPicker" role="menu" aria-label={t('thirdparty.reactions.picker')}>
            <div className="CanelaReactPicker-container" style={`--cn-react-cols: ${Math.min(7, list.length)}`}>
              {list.map((choice) => (
                <button
                  type="button"
                  role="menuitem"
                  className={classList('CanelaReactPicker-item', { 'is-used': choice.used })}
                  title={choice.label}
                  aria-label={t('thirdparty.reactions.react_with', { reaction: choice.label })}
                  onclick={(event: MouseEvent) => {
                    event.stopPropagation();
                    this.pick(choice);
                  }}
                >
                  {choice.icon}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<ReactButtonAttrs, this>) {
    this.element = vnode.dom as HTMLElement;
  }

  onupdate(vnode: Mithril.VnodeDOM<ReactButtonAttrs, this>) {
    this.element = vnode.dom as HTMLElement;
  }

  onremove() {
    window.clearTimeout(this.hoverTimer);
    window.clearTimeout(this.pressTimer);
    this.unlisten();
  }

  hasPicker(): boolean {
    return !!this.element?.querySelector('.CanelaReactPicker');
  }

  /** O seletor abre (ou fecha) com atraso, só com o mouse. */
  hover(event: PointerEvent, inside: boolean) {
    if (event.pointerType !== 'mouse' || !this.hasPicker()) return;

    window.clearTimeout(this.hoverTimer);
    this.hoverTimer = window.setTimeout(() => this.setOpen(inside), inside ? OPEN_DELAY : CLOSE_DELAY);
  }

  /** No toque, segurar o coração abre o seletor (e o clique que vem depois não curte). */
  press(event: PointerEvent) {
    this.suppressClick = false;

    if (event.pointerType === 'mouse' || !this.hasPicker()) return;

    window.clearTimeout(this.pressTimer);
    this.pressTimer = window.setTimeout(() => {
      this.suppressClick = true;
      haptic('selection' as any);
      this.setOpen(true);
    }, LONG_PRESS);
  }

  /**
   * Abre/fecha mexendo na classe direto: o post fica guardado pelo
   * SubtreeRetainer e não se redesenha por um estado só desta peça.
   */
  setOpen(open: boolean) {
    window.clearTimeout(this.hoverTimer);

    if (this.open === open) return;

    this.open = open;

    const el = this.element;

    if (!el) return;

    el.classList.toggle('is-open', open);
    el.querySelector('.CanelaReact-button')?.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open) {
      this.place();
      document.addEventListener('pointerdown', this.onDocument, true);
      document.addEventListener('keydown', this.onDocument, true);
    } else {
      this.unlisten();
    }
  }

  unlisten() {
    document.removeEventListener('pointerdown', this.onDocument, true);
    document.removeEventListener('keydown', this.onDocument, true);
  }

  /** Alinhado à esquerda do botão, sem sair da janela. */
  place() {
    const picker = this.element?.querySelector('.CanelaReactPicker') as HTMLElement | null;

    if (!picker) return;

    picker.style.setProperty('--cn-react-shift', '0px');

    const rect = picker.getBoundingClientRect();
    const overflowRight = rect.right - (document.documentElement.clientWidth - EDGE);
    let shift = 0;

    if (overflowRight > 0) shift = -overflowRight;
    if (rect.left + shift < EDGE) shift = EDGE - rect.left;

    picker.style.setProperty('--cn-react-shift', `${Math.round(shift)}px`);
  }

  main() {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }

    const { post, ui } = this.attrs;

    if (!app.session.user) {
      app.modal.show(() => flarum.reg.asyncModuleImport('flarum/forum/components/LogInModal'));
      return;
    }

    this.setOpen(false);

    const mine = myReaction(post);

    if (mine) {
      this.react(null);
      return;
    }

    if ((post as any).canLike?.()) {
      const liked = isLiked(post);

      if (!liked) ui.likeBump = Date.now();

      setLiked(post, !liked);
      return;
    }

    // Sem poder curtir (o próprio post, por exemplo), o clique abre o seletor.
    if (this.hasPicker()) this.setOpen(true);
  }

  react(reaction: any): Promise<unknown> {
    const fn = reactToPostFn();

    if (!fn) return Promise.resolve();

    return Promise.resolve(fn(this.attrs.post, reaction, this.loading)).then(() => m.redraw());
  }

  async pick(choice: Choice) {
    const { post, ui } = this.attrs;
    const mine = myReaction(post);
    const liked = isLiked(post);

    this.setOpen(false);

    if (choice.key === HEART) {
      if (choice.used) {
        if (mine) await this.react(null);
        if (liked) await setLiked(post, false);
        return;
      }

      if (mine) await this.react(null);

      ui.likeBump = Date.now();
      await setLiked(post, true);
      return;
    }

    if (choice.used) {
      await this.react(null);
      return;
    }

    if (liked) await setLiked(post, false);

    await this.react(choice.reaction);
  }
}

// ---------------------------------------------------------------------------

function unifiedActions(component: any, post: Post, items: ItemList<Mithril.Children>) {
  items.remove('react');
  items.remove('canelaLikeCount');

  const summary = unifiedSummary(post);

  if (summary) items.add('canelaReactions', summary, 1050);

  const guest = !app.session.user;

  if (!guest && !(post as any).canLike?.() && !(post as any).canReact?.()) {
    items.remove('like');
    return;
  }

  const button = m(CanelaReactButton, { post, ui: postUi(component) });

  if (items.has('like')) items.setContent('like', button);
  else items.add('like', button, 20);
}

function legacySummary(post: Post, items: ItemList<Mithril.Children>) {
  const list = counts(post);

  if (!list.length) return;

  const canSee = !!(post.discussion() as any)?.canSeeReactions?.();
  const entries = list.map(([id, count]) => ({ key: id, count, icon: reactionEmoji(app.store.getById('reactions', id)) }));

  items.add(
    'canelaReactions',
    summaryButton(post, entries, canSee ? (event) => openWhoReacted(event.currentTarget as HTMLElement, () => reactors(post)) : null),
    1050
  );
}

export default function installReactions(): void {
  extend(CommentPost.prototype, 'footerItems', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.reactions()) return;

    items.remove('reactionCounts');
  });

  // No beforeMount, como a barra do tema (topic/index.ts): registrado depois
  // dela, roda depois dela e enxerga o coração que ela já repaginou.
  app.beforeMount(() => {
    extend(CommentPost.prototype, 'actionItems', function (this: any, items: ItemList<Mithril.Children>) {
      if (!thirdParty.reactions()) return;

      const post: Post = this.attrs.post;

      if (post.isHidden()) return;

      if (unified()) unifiedActions(this, post, items);
      else legacySummary(post, items);
    });
  });

  // O "Ver reações" (coração) que o fof põe nos controles do post repetiria
  // o resumo à esquerda da barra, que já abre quem reagiu: o coração
  // aparece uma vez só.
  app.beforeMount(() => {
    extend(PostControls, 'moderationControls', function (items: ItemList<Mithril.Children>) {
      if (thirdParty.reactions() && topicSettings.postActions() && items.has('viewReactions')) items.remove('viewReactions');
    });
  });

  // O botão do fof some na unificação, mesmo que ele entre depois do tema.
  override('ext:fof/reactions/forum/components/PostReactAction', 'view', function (this: any, original: () => Mithril.Children) {
    return unified() ? null : original();
  });

  // Fora da unificação: o seletor do fof com as reações habilitadas, na ordem dele.
  override('ext:fof/reactions/forum/components/PostReactAction', 'unreactButton', function (this: any, original: () => Mithril.Children) {
    if (!thirdParty.reactions()) return original();

    const post: Post = this.post;
    const mine = app.store.getById('reactions', (post as any).userReaction?.());
    const reactToPost = reactToPostFn();

    if (!mine || !reactionComponent() || !reactToPost) return original();

    const label = app.translator.trans('fof-reactions.forum.unreact_button_label', {}, true) as string;

    return (
      <Button
        className="Button Button--link Reactions--ShowReactions CanelaReactions-mine"
        title={label}
        aria-label={label}
        loading={this.loading?.[null as any]}
        onclick={() => reactToPost(post, null, this.loading)}
      >
        {reactionEmoji(mine)}
      </Button>
    );
  });
}
