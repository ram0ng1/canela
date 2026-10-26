import type Mithril from 'mithril';
import BadgesBasePage from './BadgesBasePage';
import type Badge from '../models/Badge';
/**
 * A página /badges: os emblemas em grade, separados por
 * agrupamento (Primeiros passos, Comunidade, Postando, Nível de confiança),
 * cada um com quantas vezes foi concedido. Os que a pessoa logada já tem
 * ganham a marca de conquistado.
 */
export default class BadgesPage extends BadgesBasePage {
    badges: Badge[] | null;
    owned: Set<string>;
    oninit(vnode: Mithril.Vnode<any, this>): void;
    title(): string;
    className(): string;
    content(): Mithril.Children;
    groups(): Mithril.Children;
}
