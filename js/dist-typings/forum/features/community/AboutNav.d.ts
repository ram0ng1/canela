import type Mithril from 'mithril';
export interface LegalPage {
    key: string;
    title: string | null;
    url: string;
}
/** Uma aba extra (atributo `canelaAboutPages` do fórum, já filtrado pela visibilidade). */
export interface AboutPageTab {
    id: number;
    label: string;
    slug: string;
    icon: string;
}
export declare function legalPages(): LegalPage[];
export declare function aboutPages(): AboutPageTab[];
export declare function findAboutPage(id: number): AboutPageTab | undefined;
/** O nome da aba ativa de uma página extra (cada uma tem o seu). */
export declare function aboutPageTab(id: number): string;
export declare function aboutPageUrl(page: AboutPageTab): string;
export declare function guidelinesEnabled(): boolean;
export default function AboutNav(active: string): Mithril.Children;
