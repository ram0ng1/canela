import Extend from 'flarum/common/extenders';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';

import DraftsUserPage from './drafts/DraftsUserPage';

export default [
  // A aba de rascunhos do perfil existe sempre (os extenders rodam antes de o
  // fórum carregar as opções); sem rascunhos a página manda para as postagens.
  new Extend.Routes() //
    .add('user.drafts', '/u/:username/drafts', DraftsUserPage, UserPageResolver),
];
