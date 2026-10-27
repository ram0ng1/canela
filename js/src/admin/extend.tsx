/*
 * Extenders do admin: o painel do tema (um único item no registro; a casca
 * desenha os grupos e os cards) e as permissões próprias do tema.
 */
import Extend from 'flarum/common/extenders';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

import { trans } from './util';
import { lazyComponent } from '../forum/utils/lazy';

const KEY = 'ramon-canela.admin.settings';

const Panel = lazyComponent(
  () => import('./panel').then((mod) => mod.default),
  () => <LoadingIndicator />
);

export default [
  new Extend.Admin()
    // O painel salva cada controle sozinho e lê as chaves do `$forumSettings`
    // do extend.php: não cabe no formato de `.setting()`, então entra como
    // conteúdo próprio.
    .customSetting(() => m(Panel), 100)
    // Quem pode gerar links de convite (gaps: extend/gaps.php).
    .permission(
      () => ({
        icon: 'fas fa-user-plus',
        label: trans(`${KEY}.gaps.invite_permission`),
        permission: 'canela.createInvite',
      }),
      'start',
      80
    )
    // Quem pode relatar problemas (extend/bugreports.php).
    .permission(
      () => ({
        icon: 'fas fa-bug',
        label: trans(`${KEY}.bug_reports.permission`),
        permission: 'canela.reportBugs',
      }),
      'reply',
      40
    )
    // O chat (extend/chat.php): quem usa, abre MD, cria canais e modera. A
    // migration semeou cada uma com os grupos que as configurações antigas
    // tinham; os administradores sempre podem.
    .permission(
      () => ({
        icon: 'far fa-message',
        label: trans(`${KEY}.chat.permission_use`),
        permission: 'canela.chat.use',
      }),
      'view',
      40
    )
    .permission(
      () => ({
        icon: 'far fa-comments',
        label: trans(`${KEY}.chat.permission_direct_message`),
        permission: 'canela.chat.directMessage',
      }),
      'start',
      70
    )
    .permission(
      () => ({
        icon: 'fas fa-hashtag',
        label: trans(`${KEY}.chat.permission_create_channel`),
        permission: 'canela.chat.createChannel',
      }),
      'start',
      60
    )
    .permission(
      () => ({
        icon: 'fas fa-shield-halved',
        label: trans(`${KEY}.chat.permission_moderate`),
        permission: 'canela.chat.moderate',
      }),
      'moderate',
      40
    ),
];
