/*
 * A seção do topo da barra lateral para quem está logado: "⌂ Início",
 * "Tópicos •", "Minhas postagens", "Minhas mensagens (N)" e "Mais".
 *
 * - "Início" leva à página inicial escolhida no admin (a lista, as
 *   categorias ou um endereço). Quando Início e Tópicos dariam no mesmo
 *   lugar, "Tópicos" passa a ser a lista de Recentes explícita
 *   (/?sort=latest), para os dois nunca ficarem ativos juntos.
 * - "Minhas mensagens" (flarum/messages) ganha a contagem de conversas não
 *   lidas e fica ativa também dentro de uma conversa; o link "Mensagens" que
 *   o flarum/messages põe na navegação some daqui, porque repetiria o mesmo.
 * - O ponto de novidades ao lado de cada categoria com tópicos novos ou não
 *   lidos (o de "Tópicos" é do recurso de estatísticas).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import LinkButton from 'flarum/common/components/LinkButton';
import type Discussion from 'flarum/common/models/Discussion';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import CanelaSidebar from '../components/CanelaSidebar';
import { forumString } from './settings';
import { forumBool, isExtensionEnabled, t } from '../utils/settings';
import { categoriesRouteName, categoriesUrl, currentTag, isTagsEnabled } from '../utils/tags';
import { draftCount, draftsOn } from '../features/composer/drafts/fofDrafts';

type HomeTarget = 'index' | 'categories' | 'url';

function homeTarget(): HomeTarget {
  const value = forumString('canelaSidebarHome');

  if (value === 'categories' && isTagsEnabled()) return 'categories';
  if (value === 'url' && forumString('canelaSidebarHomeUrl')) return 'url';

  return 'index';
}

function onIndexWithoutFilter(): boolean {
  return app.current.matches(IndexPage) && app.current.get('routeName') === 'index' && !currentTag();
}

function homeLink(): Mithril.Children {
  const target = homeTarget();
  const sort = app.search.state.params().sort;

  if (target === 'url') {
    const href = forumString('canelaSidebarHomeUrl');

    return (
      <LinkButton href={href} icon="fas fa-house" external={true}>
        {t('gaps.sidebar.home')}
      </LinkButton>
    );
  }

  const href = target === 'categories' ? categoriesUrl() : app.route('index');
  const active = target === 'categories' ? app.current.get('routeName') === categoriesRouteName() : onIndexWithoutFilter() && !sort;

  return (
    <LinkButton href={href} icon="fas fa-house" active={active}>
      {t('gaps.sidebar.home')}
    </LinkButton>
  );
}

/** Os filhos de um vnode como lista, para acrescentar mais um. */
function withChild(vnode: any, child: Mithril.Children): any {
  const children = Array.isArray(vnode.children) ? vnode.children : vnode.children == null ? [] : [vnode.children];

  return m(vnode.tag, { ...vnode.attrs }, [...children, child]);
}

/**
 * Tags com tópicos novos ou não lidos entre os que o leitor já tem
 * carregados. O Flarum não manda contagem por tag; o servidor do tema manda
 * `canelaHasUnread` quando o backend dos recursos está ligado (gaps.php).
 */
function tagsWithNews(): Set<string> {
  const ids = new Set<string>();

  if (!app.session.user) return ids;

  app.store.all<Discussion>('discussions').forEach((discussion) => {
    if (!discussion.isUnread()) return;

    const tags = (discussion.tags?.() || []) as any[];

    tags.forEach((tag) => {
      if (!tag) return;

      ids.add(String(tag.id()));

      const parent = tag.parent?.();
      if (parent) ids.add(String(parent.id()));
    });
  });

  app.store.all<any>('tags').forEach((tag) => {
    if (tag.attribute('canelaHasUnread')) ids.add(String(tag.id()));
  });

  return ids;
}

export default function installSidebarHome(): void {
  extend(CanelaSidebar.prototype, 'communityItems', function (items: ItemList<Mithril.Children>) {
    if (forumBool('canelaSidebarHomeLink', true)) {
      items.add('canelaHome', homeLink(), 110);

      // Início e "Todas as Discussões" levariam à mesma lista: fica só o Início.
      if (homeTarget() === 'index' && items.has('topics')) items.remove('topics');
    }

    if (items.has('myMessages')) {
      if (items.has('messages')) items.remove('messages');

      const vnode = items.get('myMessages') as any;
      const unread = Number(app.session.user?.attribute<number>('unreadDialogCount') || 0);
      const routeName = app.current.get('routeName');

      if (vnode && vnode.attrs) {
        const children = Array.isArray(vnode.children) ? vnode.children : vnode.children == null ? [] : [vnode.children];
        const attrs = { ...vnode.attrs, active: ['messages', 'dialog', 'dialog.message'].includes(routeName) };

        items.setContent(
          'myMessages',
          m(vnode.tag, attrs, unread > 0 ? [...children, <span className="CanelaSidebar-suffix CanelaSidebar-count">{unread}</span>] : children)
        );
      }
    } else if (isExtensionEnabled('flarum-messages') && items.has('messages')) {
      // Sem o item do tema, o do flarum/messages fica com o nome do tema.
      const vnode = items.get('messages') as any;

      if (vnode && vnode.attrs) items.setContent('messages', m(vnode.tag, vnode.attrs, t('gaps.sidebar.my_messages')));
    }
  });

  // "Meus rascunhos" na barra lateral, logo abaixo de Tópicos
  // (100): sempre à mão com o fof/drafts, e com a contagem quando há algum.
  extend(CanelaSidebar.prototype, 'communityItems', function (items: ItemList<Mithril.Children>) {
    const user = app.session.user;
    const count = draftCount();

    if (!user || !draftsOn()) return;

    items.add(
      'canelaDrafts',
      <LinkButton
        icon="fas fa-pen-ruler"
        href={app.route('user.drafts', { username: user.slug() })}
        active={app.current.get('routeName') === 'user.drafts'}
      >
        {t('composer.drafts.sidebar')}
        {count > 0 && <span className="CanelaSidebar-suffix CanelaSidebar-count">{count}</span>}
      </LinkButton>,
      99
    );
  });

  extend(CanelaSidebar.prototype, 'categoryItems', function (items: ItemList<Mithril.Children>) {
    if (!app.session.user || !forumBool('canelaSidebarCategoryDots', true)) return;

    const fresh = tagsWithNews();

    if (!fresh.size) return;

    Object.keys(items.toObject()).forEach((key) => {
      const match = key.match(/^category(\d+)$/);

      if (!match || !fresh.has(match[1])) return;

      const vnode = items.get(key) as any;

      if (!vnode || typeof vnode !== 'object' || !vnode.tag) return;

      items.setContent(
        key,
        withChild(vnode, <span className="CanelaStatsDot CanelaSidebar-newDot" title={t('gaps.sidebar.new_in_category')} aria-hidden="true" />)
      );
    });
  });
}
