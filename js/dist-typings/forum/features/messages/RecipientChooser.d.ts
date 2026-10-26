import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type User from 'flarum/common/models/User';
import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';
import { type SelectKitRow } from '../../composer/SelectKit';
export interface RecipientChooserAttrs extends ComponentAttrs {
    /** Um Stream do Flarum: chamado sem argumento lê, com argumento grava. */
    recipients: {
        (): User[];
        (value: User[]): unknown;
    };
    /** Quantos destinatários cabem (o flarum/messages aceita um). */
    max: number;
    /**
     * O grupo da equipe escolhido (um Stream com o id), quando ele pode ser
     * escolhido: "mensagem à equipe" cai na caixa do grupo.
     */
    group?: {
        (): number | null;
        (value: number | null): unknown;
    };
    /** Escolher o grupo põe alguém da equipe como destinatário (o composer precisa de um). */
    groupContact?: boolean;
    /** O texto do cabeçalho vazio ("Adicionar usuários(as) ou grupos", "Selecionar…"). */
    placeholder?: string;
    className?: string;
}
export default class RecipientChooser extends Component<RecipientChooserAttrs> {
    query: string;
    results: User[];
    loading: boolean;
    /** Quem da equipe recebe quando o destinatário é o grupo (fica escondido atrás do chip). */
    contact: User | null;
    private timer;
    private requestId;
    onremove(vnode: Mithril.VnodeDOM<RecipientChooserAttrs, this>): void;
    view(): Mithril.Children;
    emptyText(): string;
    rows(filter: string): SelectKitRow[];
    groupMatches(group: Group, needle: string): boolean;
    /** Escolher o grupo: guarda o id e, no composer, põe o contato da equipe. */
    chooseGroup(): void;
    removeGroup(): void;
    /** Quem não pode ser escolhido, e por quê: não conseguiria responder. */
    unavailable(user: User): string | null;
    search(query: string): void;
    choose(key: string): void;
    remove(user: User): void;
}
