/*
 * Atribuir tópico, como o assign do Discourse (backend em extend/assign.php):
 *
 * - só com o recurso ligado no admin (`canelaAssign`);
 * - "Atribuir…", "Atribuir a mim" e "Remover atribuição" nos controles de
 *   moderação de quem tem a permissão; o responsável sempre pode se remover;
 * - a pílula "Atribuído a [avatar] Fulano" no cabeçalho do tópico e na lista;
 * - "Atribuídos a mim" na barra lateral de quem atribui: a lista em /assigned.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import username from 'flarum/common/helpers/username';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import DiscussionHero from 'flarum/forum/components/DiscussionHero';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import saveAssignee from './save';

const assignee = (discussion: Discussion): User | null => (discussion as any).canelaAssignee?.() || null;
const enabled = (): boolean => !!app.forum.attribute('canelaAssign');

function pill(user: User): Mithril.Children {
  return (
    <Link className="CanelaAssignee" href={app.route.user(user)} title={t('assign.assigned_to', { username: username(user) })}>
      <span className="CanelaAssignee-label">{t('assign.label')}</span>
      <Avatar user={user} />
      <span className="CanelaAssignee-name">{username(user)}</span>
    </Link>
  );
}

export default function installAssign(): void {
  extend(DiscussionControls, 'moderationControls', function (items: ItemList<Mithril.Children>, discussion: Discussion) {
    if (!enabled()) return;

    const me = app.session.user;
    const current = assignee(discussion);
    const mine = !!me && current === me;

    if (discussion.attribute('canCanelaAssign')) {
      items.add(
        'canelaAssign',
        <Button icon="fas fa-user-check" onclick={() => app.modal.show(() => import('./AssignModal'), { discussion })}>
          {current ? t('assign.change') : t('assign.action')}
        </Button>
      );

      if (me && !mine) {
        items.add(
          'canelaAssignSelf',
          <Button icon="fas fa-user-plus" onclick={() => saveAssignee(discussion, me)}>
            {t('assign.assign_self')}
          </Button>
        );
      }
    }

    // A própria pessoa sempre pode sair; a equipe tira qualquer um.
    if (current && (mine || discussion.attribute('canCanelaAssign'))) {
      items.add(
        'canelaUnassign',
        <Button icon="fas fa-user-xmark" onclick={() => saveAssignee(discussion, null)}>
          {mine ? t('assign.unassign_self') : t('assign.remove', { username: username(current) })}
        </Button>
      );
    }
  });

  extend(DiscussionHero.prototype, 'items', function (this: DiscussionHero, items: ItemList<Mithril.Children>) {
    if (!enabled()) return;

    const user = assignee(this.attrs.discussion);

    if (user) items.add('canelaAssignee', pill(user), -20);
  });

  extend(DiscussionListItem.prototype, 'infoItems', function (this: DiscussionListItem, items: ItemList<Mithril.Children>) {
    if (!enabled()) return;

    const user = assignee(this.attrs.discussion);

    if (user) items.add('canelaAssignee', pill(user), 5);
  });

  extend(IndexSidebar.prototype, 'navItems', function (items: ItemList<Mithril.Children>) {
    if (!app.forum.attribute('canelaCanAssign')) return;

    items.add(
      'canelaAssigned',
      <LinkButton href={app.route('canela.assigned')} icon="fas fa-user-check">
        {t('assign.nav')}
      </LinkButton>,
      65
    );
  });

  extend(DiscussionListState.prototype, 'requestParams', function (params: any) {
    if (app.current.get('routeName') !== 'canela.assigned') return;

    params.filter = { ...(params.filter || {}), canelaAssigned: 'me' };
  });

  // Pelo nome do módulo: o NotificationGrid vem no pedaço da página de
  // configurações, carregado sob demanda.
  extend('flarum/forum/components/NotificationGrid' as any, 'notificationTypes', function (items: ItemList<any>) {
    if (!enabled()) return;

    items.add('canelaAssigned', {
      name: 'canelaAssigned',
      icon: 'fas fa-user-check',
      label: t('assign.setting'),
    });
  });
}
