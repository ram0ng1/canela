/*
 * Os tipos de notificação do backend dos recursos (extend/gaps.php). Os
 * extenders rodam antes de o fórum saber das configurações, então ficam
 * sempre registrados; sem o backend, o servidor simplesmente não manda
 * notificações desses tipos.
 */
import Extend from 'flarum/common/extenders';

import { InviteAcceptedNotification, PostEditedNotification, TopicLinkedNotification } from './backend/notifications';

export default [
  new Extend.Notification() //
    .add('canelaPostEdited', PostEditedNotification)
    .add('canelaTopicLinked', TopicLinkedNotification)
    .add('canelaInviteAccepted', InviteAcceptedNotification),
];
