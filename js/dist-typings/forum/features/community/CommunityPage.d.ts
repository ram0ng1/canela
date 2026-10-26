import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import type Mithril from 'mithril';
/**
 * Base das páginas Sobre, Usuários e Grupos: o cartão do PageStructure (sem a
 * coluna lateral — a navegação está na barra global), o título da aba e o
 * histórico.
 *
 * Desligado o recurso no admin, o servidor já responde 404 a quem chega pelo
 * endereço; esta guarda cobre quem já estava com o fórum aberto quando a opção
 * mudou.
 */
export default abstract class CommunityPage<Attrs extends IPageAttrs = IPageAttrs> extends Page<Attrs> {
    oninit(vnode: Mithril.Vnode<Attrs, this>): void;
    view(): Mithril.Children;
    /** Por que a página não abre (recurso desligado, por padrão). */
    unavailableText(): string;
    abstract title(): string;
    abstract className(): string;
    abstract enabled(): boolean;
    abstract content(): Mithril.Children;
}
