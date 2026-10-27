/*
 * Os tipos de notificação do backend dos recursos (extend/gaps.php) e o
 * modelo dos convites no store. Os extenders rodam antes de o fórum saber das
 * configurações, então ficam sempre registrados; sem o backend, o servidor
 * simplesmente não manda notificações desses tipos nem convites.
 */
import Extend from 'flarum/common/extenders';

import Invite from './backend/Invite';
import { InviteAcceptedNotification, PostEditedNotification, TopicLinkedNotification } from './backend/notifications';

export default [
  new Extend.Store() //
    .add('canela-invites', Invite),

  new Extend.Notification() //
    .add('canelaPostEdited', PostEditedNotification)
    .add('canelaTopicLinked', TopicLinkedNotification)
    .add('canelaInviteAccepted', InviteAcceptedNotification),
];
