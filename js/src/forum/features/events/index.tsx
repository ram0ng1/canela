/*
 * Eventos no fórum:
 *
 * - "Criar evento" no menu ⊕ da barra do composer, ao criar a discussão (ou
 *   editar o primeiro post) na tag dos eventos;
 * - o cartão do evento no primeiro post (EventCard), no lugar do bloco que o
 *   servidor desenhou;
 * - a data do evento ("em 3 dias") ao lado do título na lista e no cabeçalho;
 * - "Próximos eventos" no topo da lista da tag dos eventos, o link "Eventos"
 *   na barra lateral e a página /events (lista e calendário);
 * - com o ramon/chat, o canal do evento encaixado à direita do tópico;
 * - o lembrete nas configurações de notificação.
 *
 * Tudo depende do backend (extend/events.php) e da chave do admin.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import IndexPage from 'flarum/forum/components/IndexPage';
import LinkButton from 'flarum/common/components/LinkButton';
import Tooltip from 'flarum/common/components/Tooltip';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';
import type Tag from 'ext:flarum/tags/common/models/Tag';
import type Mithril from 'mithril';

import CanelaSidebar from '../../components/CanelaSidebar';
import HeaderCenter from '../../shell/HeaderCenter';
import { addMoreAction } from '../../composer/installToolbar';
import { currentTag } from '../../utils/tags';
import { t } from '../../utils/settings';
import DockedChat, { canDock } from './DockedChat';
import EventCard from './EventCard';
import UpcomingEvents from './UpcomingEvents';
import { dayAndTime, relativeEventDate } from './format';
import { discussionEvent, eventsSettings, postEvent, tagsAllowEvents, type EventSummary } from './model';
import { findEvent } from './bbcode';
import { EVENTS_ROUTE } from './route';

const EventBuilderModal = () => import('./EventBuilderModal');

const EDIT = 'flarum/forum/components/EditPostComposer';
const DISCUSSION = 'flarum/forum/components/DiscussionComposer';

/** As tags do que está sendo escrito: as escolhidas no composer ou as da discussão editada. */
function composerTags(): Tag[] | null {
  const composer: any = app.composer;

  if (composer.bodyMatches(DISCUSSION)) return (composer.fields?.tags as Tag[] | undefined) || [];

  if (composer.bodyMatches(EDIT)) {
    const post: Post | undefined = composer.body?.attrs?.post;

    if (!post || post.number() !== 1) return null;

    return ((post.discussion() as Discussion | undefined)?.tags?.() as Tag[] | undefined) || [];
  }

  return null;
}

function composerAction() {
  addMoreAction(() => {
    if (!eventsSettings.on() || !app.composer.isVisible()) return null;

    const tags = composerTags();

    if (tags === null || !tagsAllowEvents(tags)) return null;

    const has = !!findEvent(app.composer.fields?.content() || '');

    return {
      key: 'canelaEvent',
      icon: 'far fa-calendar-plus',
      label: has ? t('events.builder.edit_title') : t('events.builder.create_title'),
      active: has,
      onclick: () => app.modal.show(EventBuilderModal),
    };
  });
}

/**
 * O cartão entra dentro do bloco do servidor (.CanelaEvent) e fica montado até
 * o bloco sair da página (post editado: o HTML novo traz outro bloco).
 */
function decoratePosts() {
  const unmountGone = (component: any) => {
    const mounts: HTMLElement[] = component.canelaEventMounts || [];

    component.canelaEventMounts = mounts.filter((root) => {
      if (root.isConnected) return true;

      m.mount(root, null);
      return false;
    });
  };

  extend(CommentPost.prototype, ['oncreate', 'onupdate'], function (this: any) {
    unmountGone(this);

    const post: Post = this.attrs?.post;
    const block = this.element?.querySelector?.('.Post-body .CanelaEvent') as HTMLElement | null;

    if (!post || !block || block.dataset.canelaMounted || !eventsSettings.on() || !postEvent(post)) return;

    block.dataset.canelaMounted = '1';
    block.classList.add('CanelaEvent--ready');

    const root = document.createElement('div');
    root.className = 'CanelaEvent-mount';
    block.appendChild(root);

    const description = block.querySelector('.CanelaEvent-description') as HTMLElement | null;

    m.mount(root, { view: () => <EventCard post={post} description={description} /> });
    (this.canelaEventMounts ||= []).push(root);
  });

  extend(CommentPost.prototype, 'onremove', function (this: any) {
    (this.canelaEventMounts || []).forEach((root: HTMLElement) => m.mount(root, null));
    this.canelaEventMounts = [];
  });
}

/** A pílula da data: "em 3 dias", "há 2 dias" ou "agora", com a data inteira na dica. */
export function eventDateBadge(summary: EventSummary): Mithril.Children {
  const start = new Date(summary.startsAt);
  const end = summary.endsAt ? new Date(summary.endsAt) : null;

  return (
    <Tooltip text={dayAndTime(start)}>
      <span className={`CanelaEventDate${summary.ended ? ' CanelaEventDate--past' : ''}`}>{relativeEventDate(start, end, summary.ended)}</span>
    </Tooltip>
  );
}

function listBadges() {
  extend(DiscussionListItem.prototype, 'mainView', function (this: DiscussionListItem, vnode: any) {
    if (!eventsSettings.listBadge()) return;

    const summary = discussionEvent(this.attrs.discussion);
    const title = Array.isArray(vnode?.children)
      ? vnode.children.find((child: any) => child?.attrs?.className?.includes?.('DiscussionListItem-title'))
      : null;

    if (!summary || !title || !Array.isArray(title.children)) return;

    // Logo depois do título (o link), antes da bolinha de não lidas.
    const index = title.children.findIndex((child: any) => child?.attrs?.className === 'CanelaTopic-title');
    title.children.splice(index >= 0 ? index + 1 : title.children.length, 0, eventDateBadge(summary));
  });

  extend(HeaderCenter.prototype as any, 'topic', function (vnode: any, discussion: any) {
    if (!eventsSettings.listBadge()) return;

    const summary = discussionEvent(discussion);
    const link = Array.isArray(vnode?.children) ? vnode.children[0] : null;

    if (!summary || !link || !Array.isArray(link.children)) return;

    link.children.push(eventDateBadge(summary));
  });
}

function upcomingOnTag() {
  extend(IndexPage.prototype, 'contentItems', function (items: ItemList<Mithril.Children>) {
    const tag = currentTag();

    if (!eventsSettings.upcoming() || !tag || tag.id() !== eventsSettings.tagId()) return;

    items.add('canelaUpcomingEvents', <UpcomingEvents limit={4} />, 110);
  });

  extend(CanelaSidebar.prototype, 'communityItems', function (items: ItemList<Mithril.Children>) {
    if (!eventsSettings.upcoming()) return;

    items.add(
      'canelaEvents',
      <LinkButton href={app.route(EVENTS_ROUTE)} icon="far fa-calendar">
        {t('events.sidebar')}
      </LinkButton>,
      5
    );
  });
}

/** O primeiro post: a relação da discussão ou o primeiro id do tópico. */
function firstPostOf(discussion: Discussion): Post | null {
  const related = discussion.firstPost?.() as Post | false | undefined;

  if (related) return related;

  const first = app.store.getById<Post>('posts', discussion.postIds?.()[0]);

  return first && first.number() === 1 ? first : null;
}

function dockedChat() {
  extend(DiscussionPage.prototype, 'view', function (this: any, vnode: any) {
    if (!eventsSettings.dockedChat() || !this.discussion || !vnode || !Array.isArray(vnode.children)) return;

    const event = postEvent(firstPostOf(this.discussion));

    if (!event?.chatChannelId || !canDock()) return;

    // Sem `key`: os outros filhos da página não têm, e o Mithril não aceita
    // mistura. Sempre o último, então a instância continua a mesma.
    vnode.children.push(<DockedChat channelId={event.chatChannelId} />);
  });
}

function notificationSetting() {
  // Pelo nome do módulo: o NotificationGrid vem no pedaço da página de
  // configurações, carregado sob demanda.
  extend('flarum/forum/components/NotificationGrid' as any, 'notificationTypes', function (items: ItemList<any>) {
    if (!eventsSettings.on()) return;

    items.add('canelaEventReminder', {
      name: 'canelaEventReminder',
      icon: 'far fa-calendar',
      label: t('events.notification.setting'),
    });
  });
}

export default function installEvents(): void {
  composerAction();
  decoratePosts();
  listBadges();
  upcomingOnTag();
  dockedChat();
  notificationSetting();
}
