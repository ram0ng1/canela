import { AdminComponent, type LooseAttrs } from '../util';
import type Mithril from 'mithril';
interface Entry {
    id: number;
    label: string;
    icon: string;
}
interface FofPage {
    id: number;
    title: string;
    slug: string;
}
export default class AboutPagesEditor extends AdminComponent {
    pages: FofPage[] | null;
    saveTimer: ReturnType<typeof setTimeout> | undefined;
    oninit(vnode: Mithril.Vnode<LooseAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<LooseAttrs, this>): void;
    /** Guarda em `app.data` na hora (o campo não "volta" num redesenho) e salva já ou depois da pausa. */
    write(entries: Entry[], debounce?: boolean): void;
    flush(): void;
    view(): JSX.Element;
}
export {};
