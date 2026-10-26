import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type User from 'flarum/common/models/User';
/** Quem pode trocar a capa desse usuário, pela permissão da extensão. */
export declare function canEditForumakerCover(user: User): boolean;
/** O editor da extensão (enviar, posicionar, remover). Vem do registro, nunca de um import. */
export declare function openForumakerCoverEditor(user: User): void;
export interface ForumakerCoverFieldAttrs extends ComponentAttrs {
    user: User;
}
/**
 * O campo "Capa do perfil" das Configurações com a forumaker: a prévia na
 * posição escolhida e o botão que abre o editor dela. Lê o usuário do store a
 * cada desenho, então a prévia acompanha o que o modal salvar.
 */
export declare class ForumakerCoverField extends Component<ForumakerCoverFieldAttrs> {
    view(): JSX.Element;
}
