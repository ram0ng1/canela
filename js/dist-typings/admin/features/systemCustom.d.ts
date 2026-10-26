import { AdminComponent, type LooseAttrs } from '../util';
import type Mithril from 'mithril';
type Trigger = 'activated' | 'group' | 'trust_level' | 'badge' | 'first_post' | 'verified' | 'anniversary';
interface Entry {
    id: string;
    title: string;
    enabled: boolean;
    trigger: Trigger;
    value: number | null;
    delay: number;
    subject: string;
    body: string;
    createdAt: string;
}
export default class CustomMessagesEditor extends AdminComponent {
    badges: {
        id: number;
        name: string;
    }[] | null;
    saveTimer: ReturnType<typeof setTimeout> | undefined;
    oninit(vnode: Mithril.Vnode<LooseAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<LooseAttrs, this>): void;
    write(entries: Entry[], debounce?: boolean): void;
    flush(): void;
    triggers(): {
        key: Trigger;
        label: string;
    }[];
    options(trigger: Trigger): {
        value: number;
        label: string;
    }[];
    view(): JSX.Element;
    entryView(entry: Entry, index: number, update: (index: number, patch: Partial<Entry>, debounce?: boolean) => void, remove: (index: number) => void): JSX.Element;
}
export {};
