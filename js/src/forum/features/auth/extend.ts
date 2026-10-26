/*
 * Rotas das páginas de entrar e cadastrar. Existem sempre: com a opção
 * desligada, os botões do cabeçalho continuam abrindo os modais do core.
 */
import Extend from 'flarum/common/extenders';

import AuthPage from './AuthPage';
import ResetPasswordPage from './ResetPasswordPage';

export default [
  // A página tira o modo do nome da rota (o DefaultResolver não passa attrs).
  new Extend.Routes()
    .add('canela.login', '/login', AuthPage)
    .add('canela.signup', '/signup', AuthPage)
    .add('canela.forgot', '/forgot-password', AuthPage)
    // O link do e-mail de redefinição (o servidor dá a página: extend/auth.php).
    .add('resetPassword', '/reset/:token', ResetPasswordPage),
];
