import { AdminComponent } from '../util';
export default class AdminTextarea extends AdminComponent {
    saveTimer: ReturnType<typeof setTimeout> | undefined;
    pending: string | null;
    view(): JSX.Element;
    store(value: string): void;
    flush(): void;
    onremove(vnode: any): void;
}
