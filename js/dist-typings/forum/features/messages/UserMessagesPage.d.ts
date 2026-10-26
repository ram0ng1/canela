import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import BoxListState from './BoxListState';
import { type Box } from './util';
export default class UserMessagesPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
    boxState: BoxListState | null;
    oninit(vnode: Mithril.Vnode<Attrs, this>): void;
    show(user: User): void;
    /** A caixa do endereço (a rota das caixas ou, sem o backend, a query). */
    box(): Box;
    /** O estado da caixa atual; trocar de aba (mesma página, outra rota) troca o estado. */
    listState(): BoxListState;
    content(): Mithril.Children;
    /**
     * O estado vazio (título e texto). O texto
     * aponta para o botão de mensagem do cartão de usuário e para a página
     * "Sobre", onde estão os membros da equipe.
     */
    emptyState(): Mithril.Children;
}
