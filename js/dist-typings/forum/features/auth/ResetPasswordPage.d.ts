import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import type Mithril from 'mithril';
interface ResetPayload {
    token: string;
    errors: string[];
}
export default class ResetPasswordPage extends Page<IPageAttrs> {
    protected bodyClass: string;
    loading: boolean;
    oninit(vnode: Mithril.Vnode<IPageAttrs, this>): void;
    payload(): ResetPayload | null;
    oncreate(vnode: Mithril.VnodeDOM<IPageAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<IPageAttrs, this>): void;
    view(): JSX.Element;
    form(data: ResetPayload): Mithril.Children;
    field(name: string, label: string, focus: boolean): Mithril.Children;
    /** Chegou aqui navegando dentro do fórum (sem o payload do servidor): recarrega a página. */
    unavailable(): Mithril.Children;
}
export {};
