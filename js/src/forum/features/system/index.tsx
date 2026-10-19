/*
 * O usuário do sistema no fórum (o `system` do Discourse). Sem foto própria,
 * ele usa o ícone do fórum, o mesmo que as notificações sem remetente já
 * mostravam. O resto (sem login, sem receber mensagens, fora da lista de
 * usuários, a conversa sem resposta) é do servidor (src/System) e de
 * features/messages.
 */
import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import User from 'flarum/common/models/User';

export default function installSystemUser(): void {
  override(User.prototype, 'avatarUrl', function (this: User, original: () => string | null) {
    const url = original();

    if (url || !this.attribute('canelaIsSystem')) return url;

    return app.forum.attribute<string>('faviconUrl') || app.forum.attribute<string>('logoUrl') || url;
  });
}
