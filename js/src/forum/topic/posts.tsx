/*
 * O post no jeito do Canela.
 *
 * - Cabeçalho: nome em negrito, nome de usuário e grupo em cinza, "em resposta
 *   a" com avatar, o lápis de editado e a data curta (link para o post).
 * - Barra de ações embaixo, alinhada à direita, só com ícones: contagem de
 *   curtidas (abre os avatares de quem curtiu) + coração, link (popover com o
 *   endereço do post), "…" que expande ali mesmo os controles do post, e
 *   "Responder" com texto. À esquerda, "N respostas", que abre as respostas
 *   embutidas abaixo do post.
 *
 * Os itens das extensões (likes, mentions, flags, approval…) continuam os
 * mesmos: o tema só troca a aparência e reaproveita o onclick deles.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Avatar from 'flarum/common/components/Avatar';
import Separator from 'flarum/common/components/Separator';
import Tooltip from 'flarum/common/components/Tooltip';
import CommentPost from 'flarum/forum/components/CommentPost';
import PostMeta from 'flarum/forum/components/PostMeta';
import PostUser from 'flarum/forum/components/PostUser';
import PostEdited from 'flarum/forum/components/PostEdited';
import PostControls from 'flarum/forum/utils/PostControls';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import PostModel from 'flarum/common/models/Post';
import username from 'flarum/common/helpers/username';
import humanTime from 'flarum/common/utils/humanTime';
import extractText from 'flarum/common/utils/extractText';
import classList from 'flarum/common/utils/classList';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import listItems from 'flarum/common/helpers/listItems';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import EmbeddedPost, { embeddedLoading, loadMissingContent } from './components/EmbeddedPost';
import { absoluteUrl, postUi, togglePostUi, topicSettings, type PostUi } from './ui';
import { fullDate, shortAge } from '../utils/dates';
import { isExtensionEnabled, t } from '../utils/settings';
import { copyLink } from '../utils/topicShare';
import { decorateQuotes } from './quotes';
import { userIcons } from '../utils/userIcons';
import { heartIcon, openWhoReacted, type ReactorEntry } from './components/WhoReactedPopover';

/** Posts respondidos já pedidos ao servidor (para não buscar de novo a cada redesenho). */
const requestedParents = new Set<string>();

export default function installPosts(): void {
  extend(CommentPost.prototype, 'oninit', function (this: any) {
    const ui = postUi(this);

    this.subtree.check(() => ui.version);
  });

  extend(CommentPost.prototype, 'onremove', function (this: any) {
    window.clearTimeout(postUi(this).copiedTimer);
  });

  // O avatar dentro de um bloco próprio, com o "flair" do grupo no canto:
  // assim os dois descem juntos com a leitura (o avatar é sticky).
  extend(CommentPost.prototype, 'sideItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!items.has('avatar')) return;

    const user = this.attrs.post.user();
    const badges = user ? user.badges().toArray() : [];
    // A presença em modo "anel":
    // um anel verde em volta do avatar, sem pontinho.
    const online = !!user && user.isOnline();

    items.setContent(
      'avatar',
      <div className={online ? 'CanelaPostAvatar CanelaPostAvatar--online' : 'CanelaPostAvatar'}>
        {items.get('avatar')}
        {badges.length ? <ul className="CanelaPostAvatar-flair badges">{listItems(badges)}</ul> : null}
      </div>
    );
  });

  // Os ícones depois do nome (selo de verificado, emoji de status: ver
  // utils/userIcons) ficam fora do link do autor, na linha do nome: o clique
  // neles não abre o cartão, e o popover do selo funciona.
  extend(PostUser.prototype, 'userViewItems', function (this: any, items: ItemList<Mithril.Children>, user: User) {
    const icons = userIcons(user, 'post');
    const name = items.has('postUser-name') ? (items.get('postUser-name') as any) : null;

    if (!icons || !name || !Array.isArray(name.children)) return;

    items.setContent('postUser-name', m(name.tag, name.attrs, [...name.children, icons]));
  });

  // Citações com cabeçalho e a menção de "respondendo a" escondida: mexe no
  // HTML já renderizado, então roda depois de cada desenho do conteúdo.
  extend(CommentPost.prototype, ['oncreate', 'onupdate'], function (this: any) {
    const body = this.element?.querySelector?.('.Post-body');

    if (body) {
      // A menção que marca a resposta sai do texto quando o "em resposta a"
      // mora no cabeçalho (nos dois estilos dele).
      const replyInHeader = topicSettings.embeddedReplies() || topicSettings.replyToLine();
      decorateQuotes(body, this.attrs.post, replyInHeader ? replyMarkerId(this.attrs.post) : null);
      markUnavailableMentions(body);
    }
  });

  // Sem o dropdown do core: o "…" do tema expande os controles na barra.
  override(CommentPost.prototype, 'controls', function (this: any, original: () => Mithril.Children[]) {
    return topicSettings.postActions() ? [] : original();
  });

  extend(CommentPost.prototype, 'actionItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (topicSettings.postActions()) buildActions(this, items);
  });

  extend(CommentPost.prototype, 'footerItems', function (this: any, items: ItemList<Mithril.Children>) {
    buildFooter(this, items);
  });

  extend(CommentPost.prototype, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
    buildHeader(this, items);
  });

  // O post respondido abre acima do post inteiro, como o "embedded post" do topo.
  extend(CommentPost.prototype, 'content', function (this: any, content: Mithril.Children[]) {
    const ui = postUi(this);

    if (!ui.parent || !topicSettings.embeddedReplies()) return;

    const parentId = parentPostId(this.attrs.post);

    if (parentId) content.unshift(<ParentPost id={parentId} ui={ui} />);
  });

  // A data curta ("4 h", "8 jun") com a completa no title, mas
  // o clique continua abrindo o menu do core (data completa + link do post),
  // como o usuário pediu.
  extend(PostMeta.prototype, 'viewItems', function (this: any, items: ItemList<Mithril.Children>) {
    const post = this.attrs.post;
    const time: Date | undefined = post.createdAt?.();

    if (!time || !items.has('time')) return;

    const label = <time dateTime={time.toISOString()}>{shortAge(time)}</time>;
    const original = items.get('time') as any;

    items.setContent('time', m(original?.tag || 'button', { ...(original?.attrs || {}), title: fullDate(time) }, label));
  });

  // "Editado" vira um lápis, com o mesmo tooltip de quem editou.
  override(PostEdited.prototype, 'view', function (this: any, original: () => Mithril.Children) {
    const post = this.attrs.post;

    // Com revisões guardadas, vale o lápis do histórico (features/extras/
    // history), que abre o modal comparando as versões.
    if (Number(post.attribute('canelaRevisionCount')) > 0) return original();
    const info = app.translator.trans('core.forum.post.edited_tooltip', { user: post.editedUser(), ago: humanTime(post.editedAt()) });

    return (
      <Tooltip text={extractText(info)}>
        <span className="PostEdited CanelaPostEdited" aria-label={extractText(info)}>
          <Icon name="fas fa-pencil-alt" />
        </span>
      </Tooltip>
    );
  });
}

// ---------------------------------------------------------------------------
// Cabeçalho
// ---------------------------------------------------------------------------

function buildHeader(post: any, items: ItemList<Mithril.Children>) {
  const model: PostModel = post.attrs.post;
  const user = model.user();

  // A ordem: nome em negrito, o nome de usuário (quando é
  // outro) e o título em cinza (features/profile). O grupo não entra em
  // texto: ele já aparece como flair no avatar.
  if (user && user.username() !== user.displayName()) {
    items.add(
      'canelaNames',
      <span className="CanelaPostNames">
        <span className="CanelaPostNames-username">{user.username()}</span>
      </span>,
      95
    );
  }

  // O "…" do core que mostra o conteúdo do post excluído repetia o "…" da
  // barra de ações logo abaixo: vira um olho, com rótulo.
  if (items.has('toggle')) {
    const original = items.get('toggle') as any;
    const open = !!post.revealContent;
    const label = t(open ? 'topic.post.hide_hidden' : 'topic.post.show_hidden');

    items.setContent(
      'toggle',
      <Button
        {...(original?.attrs || {})}
        className="Button Button--icon Button--flat Button--more CanelaPostReveal"
        icon={open ? 'far fa-eye-slash' : 'far fa-eye'}
        aria-label={label}
        aria-pressed={open ? 'true' : 'false'}
        title={label}
      />
    );
  }

  // O "em resposta a" do avocado: uma linha embaixo do nome ("↳ Em resposta
  // a [avatar] Fulano") no lugar do "↩ Fulano" à direita do cabeçalho.
  const line = topicSettings.replyToLine();
  const embedded = topicSettings.embeddedReplies();

  if (!embedded && !line) return;

  const parentId = parentPostId(model);

  // Na linha do avocado ele aparece também quando o post respondido é o de
  // cima; o do tema só quando não é (logo acima, ele é óbvio).
  if (parentId && (line || !isPreviousPost(model, parentId))) {
    const ui = postUi(post);
    const parent = app.store.getById<PostModel>('posts', parentId);
    const mentioned = mentionText(model, parentId);
    // O post respondido pode não estar carregado (fora da página atual do
    // stream): o autor sai do store pelo nome da menção e, se nem ele estiver,
    // o post é buscado uma vez para o avatar aparecer.
    const parentUser =
      (parent ? parent.user() : null) ||
      (typeof mentioned === 'string' ? app.store.getBy<any>('users', 'username', mentioned.replace(/^@/, '')) || null : null);

    if (!parent && !parentUser && !requestedParents.has(parentId)) {
      requestedParents.add(parentId);
      app.store.find('posts', parentId).then(
        () => m.redraw(),
        () => {}
      );
    }

    const name = parentUser ? username(parentUser) : mentioned;

    // Com as respostas embutidas o clique abre o post respondido acima deste;
    // sem elas (só na linha do avocado), leva até ele.
    const onclick = () => {
      if (embedded) {
        togglePostUi(ui, 'parent');
      } else if (parent) {
        m.route.set(app.route.post(parent));
      }
    };

    items.add(
      'canelaReplyTo',
      <button
        type="button"
        className={classList('CanelaReplyTo', { 'CanelaReplyTo--open': embedded && ui.parent, 'CanelaReplyTo--line': line })}
        aria-expanded={embedded ? (ui.parent ? 'true' : 'false') : undefined}
        title={t('topic.post.in_reply_to')}
        onclick={onclick}
      >
        <Icon name={line ? 'fas fa-reply' : 'fas fa-share'} className="CanelaReplyTo-icon" />
        {line ? <span className="CanelaReplyTo-label">{t('topic.post.reply_to_label')}</span> : null}
        {parentUser ? <Avatar user={parentUser} /> : null}
        <span className="CanelaReplyTo-name">{name}</span>
        {userIcons(parentUser || null, 'replyTo')}
      </button>,
      5
    );
  }
}

/**
 * O "em resposta a" só aparece quando o post respondido não é o
 * imediatamente anterior — logo acima, ele é óbvio.
 */
function isPreviousPost(post: PostModel, parentId: string): boolean {
  const parent = app.store.getById<PostModel>('posts', parentId);

  return !!parent && parent.discussion() === post.discussion() && parent.number() === post.number() - 1;
}

/**
 * O post a que este responde: a primeira menção de post (`@fulano#123`) do
 * conteúdo. O Flarum não guarda um "respondendo a", mas a
 * resposta do mentions sempre começa com essa menção.
 */
function parentPostId(post: PostModel): string | null {
  const html = post.contentHtml() || '';
  const cache = (post as any).canelaParent as { html: string; id: string | null } | undefined;

  if (cache && cache.html === html) return cache.id;

  let id: string | null = null;

  if (html.indexOf('PostMention') !== -1) {
    const link = parseHtml(html).querySelector('a.PostMention:not(.PostMention--deleted)[data-id]');
    id = link?.getAttribute('data-id') || null;
  }

  (post as any).canelaParent = { html, id };

  return id;
}

/**
 * A menção que marca a resposta: a que abre o primeiro parágrafo (e não a de
 * uma citação, que o tema transforma em cabeçalho).
 */
function replyMarkerId(post: PostModel): string | null {
  const id = parentPostId(post);

  return id && /^\s*<p>\s*<a [^>]*class="PostMention"/.test(post.contentHtml() || '') ? id : null;
}

// DOMParser, e não innerHTML num <div>: o documento inerte não baixa as imagens do post.
function parseHtml(html: string): HTMLElement {
  return new DOMParser().parseFromString(html, 'text/html').body;
}

/** O texto da menção ("Fulano") quando o post respondido ainda não foi carregado. */
function mentionText(post: PostModel, id: string): string {
  const link = parseHtml(post.contentHtml() || '').querySelector(`a.PostMention[data-id="${id}"]`);

  return (link?.textContent || '').replace(/^@/, '').trim();
}

interface ParentPostAttrs {
  id: string;
  ui: PostUi;
}

/**
 * Busca o post respondido (se preciso) e o mostra embutido no topo. Um post
 * apagado ou invisível só deixa de aparecer: o alerta de erro do core seria
 * barulho demais para um clique de "ver mais".
 */
class ParentPost {
  loading = false;
  failed = false;

  oninit(vnode: Mithril.Vnode<ParentPostAttrs, this>) {
    const post = app.store.getById<PostModel>('posts', vnode.attrs.id);

    if (post && post.contentHtml()) return;

    this.loading = true;

    app.store
      .find<PostModel>('posts', vnode.attrs.id, {}, { errorHandler: () => {} })
      .catch(() => (this.failed = true))
      .finally(() => {
        this.loading = false;
        vnode.attrs.ui.version++;
        m.redraw();
      });
  }

  view(vnode: Mithril.Vnode<ParentPostAttrs, this>) {
    const post = app.store.getById<PostModel>('posts', vnode.attrs.id);

    return (
      <div className="CanelaEmbedded CanelaEmbedded--top">
        {this.loading ? embeddedLoading() : post && !this.failed ? <EmbeddedPost post={post} direction="up" /> : null}
      </div>
    );
  }
}

// ---------------------------------------------------------------------------
// Barra de ações
// ---------------------------------------------------------------------------

function buildActions(component: any, items: ItemList<Mithril.Children>) {
  const post: PostModel = component.attrs.post;
  const ui = postUi(component);

  // O post oculto fica como no Flarum: só os controles de moderação
  // (restaurar, excluir de vez) — curtir, reagir e responder não valem para ele.
  if (post.isHidden()) {
    ['like', 'react', 'reply', 'canelaReactions', 'canelaLikeCount'].forEach((key) => items.has(key) && items.remove(key));
    addMore(component, post, ui, items);
    return;
  }

  addRepliesToggle(post, ui, items);
  restyleLike(post, ui, items);
  items.add('canelaShare', <ShareAction post={post} ui={ui} />, -10);
  addMore(component, post, ui, items);
  restyleReply(post, items);
}

/** "N respostas ▾" à esquerda, que expande as respostas embutidas. */
function addRepliesToggle(post: PostModel, ui: PostUi, items: ItemList<Mithril.Children>) {
  if (!topicSettings.embeddedReplies()) return;

  const count = Number(post.attribute('mentionedByCount')) || 0;

  if (!count) return;

  items.add(
    'canelaReplies',
    <Button
      className={classList('Button Button--flat CanelaPostAction CanelaPostAction--replies', { active: ui.replies })}
      aria-expanded={ui.replies ? 'true' : 'false'}
      onclick={() => togglePostUi(ui, 'replies')}
    >
      {t('topic.post.replies', { count })}
      <Icon name={ui.replies ? 'fas fa-chevron-up' : 'fas fa-chevron-down'} className="CanelaPostAction-chevron" />
    </Button>,
    1000
  );
}

/**
 * Curtidas: à esquerda, o coração cheio com a contagem (abre os
 * avatares de quem curtiu); à direita, só o coração de curtir. Visitante vê o
 * coração e, ao clicar, a janela de entrar.
 */
function restyleLike(post: PostModel, ui: PostUi, items: ItemList<Mithril.Children>) {
  if (!isExtensionEnabled('flarum-likes') || post.isHidden()) return;

  const likes: User[] = ((post as any).likes?.() || []).filter(Boolean);
  const count = Number(post.attribute('likesCount')) || likes.length;
  const original = items.has('like') ? (items.get('like') as any) : null;
  const guest = !app.session.user;

  if (count > 0) {
    items.add(
      'canelaLikeCount',
      <Button
        className="Button Button--flat CanelaPostAction CanelaLikeCount"
        icon="fas fa-heart"
        aria-haspopup="dialog"
        aria-label={t('topic.post.who_liked')}
        title={t('topic.post.who_liked')}
        onclick={(event: MouseEvent) => openWhoReacted(event.currentTarget as HTMLElement, () => likers(post))}
      >
        <span className="CanelaLikeCount-number">{abbreviateNumber(count)}</span>
      </Button>,
      1100
    );
  }

  if (!original && !guest) return;

  const liked = !guest && likes.indexOf(app.session.user!) !== -1;
  const label = guest ? t('topic.post.like_guest') : t(liked ? 'topic.post.unlike' : 'topic.post.like');

  const onclick = (event: MouseEvent) => {
    if (guest) {
      app.modal.show(() => flarum.reg.asyncModuleImport('flarum/forum/components/LogInModal'));
      return;
    }

    // A batida do coração ao curtir.
    if (!liked) ui.likeBump = Date.now();

    const result = original?.attrs?.onclick?.(event);

    // O flarum/likes muda a lista de quem curtiu na hora, mas a contagem só
    // volta na resposta do servidor, e ninguém redesenha depois dela: ao
    // descurtir, o "♥ 1" da esquerda ficava até o próximo clique. A contagem
    // muda junto (a resposta confirma o número), como no setLiked das reações.
    const current = Number(post.attribute('likesCount')) || 0;
    post.pushAttributes({ likesCount: Math.max(0, current + (liked ? -1 : 1)) } as any);

    return result;
  };

  const content = (
    <Button
      className={classList('Button Button--icon Button--flat CanelaPostAction CanelaLike-toggle', {
        'CanelaLike--liked': liked,
        'CanelaLike--bump': liked && ui.likeBump && Date.now() - ui.likeBump < 1000,
      })}
      icon={liked ? 'fas fa-heart' : 'far fa-heart'}
      aria-label={label}
      aria-pressed={liked ? 'true' : 'false'}
      title={label}
      onclick={onclick}
    />
  );

  if (original) items.setContent('like', content);
  else items.add('like', content, 20);
}

/**
 * O "Responder" do mentions (ou o do tema, sem ele), com ícone e texto. O
 * visitante não vê: ele responde pelo botão do fim do tópico.
 */
function restyleReply(post: PostModel, items: ItemList<Mithril.Children>) {
  const className = 'Button Button--flat CanelaPostAction CanelaPostAction--reply';

  if (!app.session.user) {
    if (items.has('reply')) items.remove('reply');
    return;
  }

  if (items.has('reply')) {
    const original = items.get('reply') as any;

    items.setContent(
      'reply',
      <Button {...(original?.attrs || {})} className={className} icon="fas fa-reply">
        {original?.children}
      </Button>
    );

    return;
  }

  const discussion = post.discussion();

  if (post.isHidden() || !discussion.canReply()) return;

  items.add(
    'reply',
    <Button className={className} icon="fas fa-reply" onclick={() => DiscussionControls.replyAction.call(discussion, true, false).catch(() => {})}>
      {t('topic.post.reply')}
    </Button>,
    -100
  );
}

/** O "…": some e dá lugar aos controles, como ícones na barra. */
function addMore(component: any, post: PostModel, ui: PostUi, items: ItemList<Mithril.Children>) {
  const list = PostControls.controls(post, component).toArray();

  // Algumas extensões entregam o item como lista de vnodes (o "Dividir a
  // partir daqui" do fof/split): achatada só para saber se há o que mostrar.
  if (!flattenControls(list).length) return;

  // O "…" abre um menu com os controles (ícone + texto), em vez de espalhar
  // os ícones na barra: com moderação, extensões e post oculto eram muitos
  // botões numa linha (pedido do usuário).
  items.add(
    'canelaMore',
    // A dica do "…" some com o menu aberto (ficaria por cima dos itens).
    <Tooltip text={t('topic.post.more_short')} tooltipVisible={ui.more ? false : undefined}>
      <Dropdown
        className="CanelaPostMore"
        buttonClassName="Button Button--icon Button--flat CanelaPostAction CanelaPostAction--more"
        menuClassName="Dropdown-menu--right"
        icon="fas fa-ellipsis-h"
        caretIcon=""
        label=""
        accessibleToggleLabel={t('topic.post.show_more')}
        // O post só redesenha quando `ui.version` muda (SubtreeRetainer):
        // sem isto, o menu não reabria na segunda vez.
        onshow={() => {
          togglePostUi(ui, 'more', true);
          m.redraw();
        }}
        onhide={() => {
          togglePostUi(ui, 'more', false);
          m.redraw();
        }}
      >
        {list}
      </Dropdown>
    </Tooltip>,
    -50
  );
}

/** Achata os itens dos controles (vnode, lista de vnodes ou item vazio) e tira os separadores. */
function flattenControls(list: any[]): any[] {
  const out: any[] = [];

  list.forEach((item: any) => {
    if (!item || item.tag === Separator) return;

    if (Array.isArray(item)) {
      const inner = flattenControls(item);
      const name = (item as any).itemName as string | undefined;

      // O nome do item (itemName) fica na lista; os botões de dentro herdam.
      inner.forEach((child, i) => {
        if (child && typeof child === 'object' && !child.itemName) child.itemName = inner.length > 1 ? `${name || 'item'}-${i}` : name;
      });
      out.push(...inner);
      return;
    }

    out.push(item);
  });

  return out;
}

interface ShareActionAttrs {
  post: PostModel;
  ui: PostUi;
}

/** Quanto tempo o ícone fica como "copiado". */
const COPIED_MS = 2000;

/**
 * O link: o clique copia o endereço do post na hora (sem
 * janela) e o ícone vira um "certo" por um instante.
 */
class ShareAction {
  view(vnode: Mithril.Vnode<ShareActionAttrs, this>) {
    const { post, ui } = vnode.attrs;

    const copy = () => {
      const url = absoluteUrl(app.route.post(post));
      const done = () => {
        window.clearTimeout(ui.copiedTimer);
        togglePostUi(ui, 'share', true);
        m.redraw();
        ui.copiedTimer = window.setTimeout(() => {
          togglePostUi(ui, 'share', false);
          m.redraw();
        }, COPIED_MS);
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(done, () => copyLink(url));
      } else {
        copyLink(url);
      }
    };

    // Logo depois de copiar, o retorno "Link copiado!" (motion/feedback)
    // ocupa o lugar da dica em cima do botão.
    return (
      <Tooltip text={t('topic.post.share_short')} tooltipVisible={ui.share ? false : undefined}>
        <Button
          className={classList('Button Button--icon Button--flat CanelaPostAction CanelaPostAction--share', { 'CanelaPostAction--copied': ui.share })}
          icon="fas fa-link"
          aria-label={t('topic.post.share')}
          onclick={copy}
        />
      </Tooltip>
    );
  }
}

// ---------------------------------------------------------------------------
// Rodapé: quem curtiu e respostas embutidas
// ---------------------------------------------------------------------------

function buildFooter(component: any, items: ItemList<Mithril.Children>) {
  const post: PostModel = component.attrs.post;
  const ui = postUi(component);

  if (topicSettings.postActions() && isExtensionEnabled('flarum-likes')) {
    // A frase "Fulano curtiu isto" vira o popover de quem curtiu, aberto pela
    // contagem à esquerda da barra.
    items.remove('liked');
  }

  if (topicSettings.embeddedReplies()) {
    items.remove('replies');

    if (ui.replies) items.add('canelaEmbeddedReplies', <EmbeddedReplies post={post} ui={ui} />, 90);
  }
}

/**
 * Quem curtiu, para o popover: os que vieram com o post e, se a contagem diz
 * que há mais, a lista inteira pela API (o filtro `liked` do flarum/likes).
 */
export function likers(post: PostModel): Promise<ReactorEntry[]> {
  const loaded: User[] = ((post as any).likes?.() || []).filter(Boolean);
  const count = Number(post.attribute('likesCount')) || loaded.length;
  const entries = (users: User[]) => users.map((user) => ({ user, icon: heartIcon() }));

  if (loaded.length >= count) return Promise.resolve(entries(loaded));

  return app.store
    .find<User[]>('users', { filter: { liked: post.id()! }, page: { limit: 50 } } as any, undefined, { errorHandler: () => {} })
    .then((users) => entries(Array.from(users)))
    .catch(() => entries(loaded));
}

interface EmbeddedRepliesAttrs {
  post: PostModel;
  ui: PostUi;
}

class EmbeddedReplies {
  loading = false;

  replies(post: PostModel): PostModel[] {
    return (((post as any).mentionedBy?.() || []) as PostModel[])
      .filter((reply) => reply && !reply.isHidden())
      .sort((a, b) => a.number() - b.number());
  }

  oninit(vnode: Mithril.Vnode<EmbeddedRepliesAttrs, this>) {
    const replies = this.replies(vnode.attrs.post);

    if (replies.every((reply) => reply.contentHtml())) return;

    this.loading = true;

    loadMissingContent(replies)
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        vnode.attrs.ui.version++;
        m.redraw();
      });
  }

  view(vnode: Mithril.Vnode<EmbeddedRepliesAttrs, this>) {
    const post = vnode.attrs.post;
    const replies = this.replies(post);
    const total = Number(post.attribute('mentionedByCount')) || replies.length;
    const MentionedByModal = (flarum as any).reg.checkModule('flarum-mentions', 'forum/components/MentionedByModal');

    return (
      <div className="CanelaEmbedded CanelaEmbedded--bottom">
        {this.loading ? embeddedLoading() : replies.map((reply) => <EmbeddedPost post={reply} direction="down" />)}
        {!this.loading && total > replies.length && MentionedByModal && (
          <Button className="Button Button--flat CanelaEmbedded-more" onclick={() => app.modal.show(MentionedByModal, { post })}>
            {t('topic.post.more_replies', { count: total - replies.length })}
          </Button>
        )}
      </div>
    );
  }
}

/**
 * Menção a uma postagem que o leitor não pode ver (oculta, apagada ou num
 * tópico restrito): o mentions escreve "[desconhecido]" dentro da pílula de
 * resposta. Vira um texto discreto, sem a pílula nem o link, que não levaria
 * a lugar nenhum para quem lê.
 */
function markUnavailableMentions(body: HTMLElement): void {
  const unknown = extractText(app.translator.trans('flarum-mentions.forum.post_mention.deleted_text'));

  body.querySelectorAll<HTMLElement>('.PostMention').forEach((link) => {
    if (link.classList.contains('PostMention--deleted') || (unknown && link.textContent?.trim() === unknown)) {
      const span = document.createElement('span');
      span.className = 'CanelaMention-unavailable';
      span.textContent = t('topic.post.mention_unavailable');
      link.replaceWith(span);
    }
  });
}
