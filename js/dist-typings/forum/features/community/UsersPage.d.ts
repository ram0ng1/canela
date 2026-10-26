import type Mithril from 'mithril';
import CommunityPage from './CommunityPage';
import DirectoryState from './DirectoryState';
/**
 * O diretório de usuários (/u): quem participa e quanto, no
 * período escolhido.
 *
 * Os filtros ficam na URL (?period=weekly&order=postCount…),
 * para dar para compartilhar a tabela. A URL é trocada com
 * `replaceState`, e não pelo roteador: mudar a rota recriaria a página e
 * jogaria fora as linhas já carregadas.
 */
export default class UsersPage extends CommunityPage {
    directory: DirectoryState;
    private lastQuery;
    oninit(vnode: Mithril.Vnode<any, this>): void;
    onupdate(vnode: Mithril.VnodeDOM<any, this>): void;
    title(): string;
    className(): string;
    enabled(): boolean;
    unavailableText(): string;
    content(): Mithril.Children;
    private syncUrl;
}
