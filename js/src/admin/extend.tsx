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
        label: trans(`${KEY}.gaps.invite_permission`, 'Convidar pessoas (links de convite)'),
        permission: 'canela.createInvite',
      }),
      'start',
      80
    )
    // Quem pode relatar problemas (extend/bugreports.php).
    .permission(
      () => ({
        icon: 'fas fa-bug',
        label: trans(`${KEY}.bug_reports.permission`, 'Relatar problemas (marcar a tela e enviar)'),
        permission: 'canela.reportBugs',
      }),
      'reply',
      40
    ),
];
