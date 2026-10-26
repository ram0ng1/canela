import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import type Mithril from 'mithril';
export type AuthMode = 'login' | 'signup' | 'forgot';
export type AuthLayout = 'card' | 'discourse' | 'split';
/** Guarda a página de onde a pessoa veio: depois de entrar, ela volta para lá. */
export declare function rememberReturn(): void;
export declare function goToAuth(mode: AuthMode, attrs?: Record<string, unknown>): void;
/**
 * Sem o cabeçalho e com o fundo destas páginas (o PreBootShell já faz isso
 * quando a página abre direto nelas); ao sair, o fundo do fórum volta.
 */
export declare function enterAuthRoute(): void;
export declare function leaveAuthRoute(): void;
/** Um texto das páginas escolhido no admin (ou no rascunho da pré-visualização); vazio = o padrão. */
export declare function authText(attribute: string): string;
/** "Voltar para entrar", debaixo do cartão das páginas de senha. */
export declare function backToLogin(): Mithril.Children;
export default class AuthPage extends Page<IPageAttrs> {
    protected bodyClass: string;
    form: any;
    formAttrs: Record<string, unknown>;
    mode(): AuthMode;
    layout(): AuthLayout;
    oninit(vnode: Mithril.Vnode<IPageAttrs, this>): void;
    oncreate(vnode: Mithril.VnodeDOM<IPageAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<IPageAttrs, this>): void;
    view(): JSX.Element;
    logo(): Mithril.Children;
    /** O painel colorido da tela dividida: o logo, o título e a frase do admin (ou os padrões). */
    panel(mode: AuthMode): Mithril.Children;
}
/** O logo do fórum em cima do cartão (a versão escura no tema escuro). */
export declare function authLogo(): Mithril.Children;
