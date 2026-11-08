/* Extenders do atribuir tópico: o responsável no modelo, a rota /assigned e o alerta. */
import Extend from 'flarum/common/extenders';
import Discussion from 'flarum/common/models/Discussion';
import IndexPage from 'flarum/forum/components/IndexPage';

import AssignedNotification from './AssignedNotification';

export default [
  new Extend.Model(Discussion) //
    .hasOne('canelaAssignee')
    .attribute<boolean>('canCanelaAssign'),

  new Extend.Routes() //
    .add('canela.assigned', '/assigned', IndexPage),

  new Extend.Notification() //
    .add('canelaAssigned', AssignedNotification),
];
