import type Group from 'flarum/common/models/Group';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';
import CommunityPage from './CommunityPage';
import DirectoryState from './DirectoryState';
type Tab = 'members' | 'activity';
/**
 * A página de um grupo (/g/:nome): o cabeçalho com o símbolo e o
 * nome, e as abas Membros e Atividade.
 *
 * A aba vai na própria URL (?tab=activity) pelo mesmo motivo do diretório:
 * trocar de aba não deve recriar a página e perder a lista carregada.
 */
export default class GroupPage extends CommunityPage {
    group: Group | null;
    tab: Tab;
    members: DirectoryState | null;
    posts: Post[];
    postsLoading: boolean;
    postsLoaded: boolean;
    postsPage: number;
    postsHasMore: boolean;
    oninit(vnode: Mithril.Vnode<any, this>): void;
    title(): string;
    className(): string;
    enabled(): boolean;
    activityEnabled(): boolean;
    canViewMembers(): boolean;
    content(): Mithril.Children;
    /** O `group-details-container`: o flair de 50px, o nome grande e o @endereço. */
    header(group: Group): Mithril.Children;
    tabs(): Mithril.Children;
    tabButton(tab: Tab, icon: string, label: string, count?: number | null): Mithril.Children;
    setTab(tab: Tab): void;
    membersView(): Mithril.Children;
    loadActivity(): void;
    activity(): Mithril.Children;
    /** Um item do "stream" de atividade: avatar, tópico, quando e o começo do texto. */
    streamItem(post: Post): Mithril.Children;
}
export {};
