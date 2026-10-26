import { AdminComponent } from '../util';
export declare class ForumBackgroundEditor extends AdminComponent {
    draft: string;
    view(): JSX.Element;
}
interface AuthDraft {
    layout: string;
    background: string;
    texts: Record<string, string>;
}
/** Um card de leiaute e fundo, outro de textos: cada um salva só a sua parte. */
type AuthSection = 'layout' | 'texts';
export declare class AuthPagesEditor extends AdminComponent {
    draft: AuthDraft;
    section(): AuthSection;
    /** A parte do outro card vem sempre do que está salvo (para a prévia e o painel da tela dividida). */
    syncOther(): void;
    dirty(): boolean;
    previewState(): Record<string, unknown>;
    apply(): void;
    text(key: string, label: string, placeholder: string, multiline?: boolean): JSX.Element;
    view(): JSX.Element;
    layoutView(): JSX.Element[];
    textsView(): (false | JSX.Element | JSX.Element[])[];
}
export {};
