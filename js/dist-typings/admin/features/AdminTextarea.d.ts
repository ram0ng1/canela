import { AdminComponent, type LooseAttrs } from '../util';
import type Mithril from 'mithril';
export default class AdminTextarea extends AdminComponent {
    saveTimer: ReturnType<typeof setTimeout> | undefined;
    pending: string | null;
    view(): JSX.Element;
    store(value: string): void;
    flush(): void;
    onremove(vnode: Mithril.VnodeDOM<LooseAttrs, this>): void;
}
