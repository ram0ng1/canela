import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';
export type ComposerKind = 'new_topic' | 'reply' | 'edit' | (string & {});
/** Uma ação do menu do cabeçalho: ícone, rótulo em negrito e descrição. */
export interface ComposerAction {
    icon: string;
    label: string;
    description: string;
    onclick: () => void;
}
export interface ComposerActionTitleAttrs extends ComponentAttrs {
    kind: ComposerKind;
    discussion?: Discussion;
    post?: Post;
    /** Rótulo e ícone próprios (outro composer, como o de mensagens). */
    label?: string;
    icon?: string;
    /** O título digitado no tópico novo (para a barra minimizada). */
    title?: () => string;
}
/**
 * Troca o tipo do composer levando o texto já escrito (as ações "Responder
 * ao tópico" / "Iniciar Discussão" do menu). A pergunta "descartar?"
 * não faz sentido: o texto vai junto.
 */
declare function switchTo(kind: 'reply' | 'new_topic', discussion: Discussion | null): Promise<void>;
export { switchTo as switchComposer };
export default class ComposerActionTitle extends Component<ComposerActionTitleAttrs> {
    view(): Mithril.Children;
    /** A barra do composer minimizado (`#reply-control.draft .draft-text`). */
    draftView(): Mithril.Children;
    label(): string;
    icon(): string;
    trigger(): Mithril.Children;
    /**
     * As OUTRAS ações do menu (`composer-actions`): a atual não aparece. Trocar
     * de tipo leva o título e o texto. É o ponto de extensão do menu: outro
     * recurso (as mensagens privadas) estende este método para pôr "Criar
     * mensagem" / "Responder como mensagem privada":
     *
     *   extend(ComposerActionTitle.prototype, 'actionItems', function (items) {
     *     items.add('message', { icon, label, description, onclick }, 50);
     *   });
     *
     * `this.attrs.kind` diz qual composer está aberto ('new_topic' | 'reply' |
     * 'edit', ou o que o outro composer passar).
     */
    actionItems(): ItemList<ComposerAction>;
    /** Um item do menu de ações: ícone, rótulo em negrito e a descrição. */
    actionButton(icon: string, label: string, description: string, onclick: (() => void) | null, current?: boolean): Mithril.Children;
    /**
     * "🔗 título": o destino da resposta ou da edição. Na resposta, só quando o
     * tópico não está aberto atrás do composer — ele some ao responder do
     * próprio tópico. No celular, sempre: lá o editor
     * ocupa a tela e esconde o tópico.
     */
    targetLink(): Mithril.Children;
}
