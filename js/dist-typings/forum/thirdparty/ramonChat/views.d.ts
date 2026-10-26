import type Mithril from 'mithril';
type AnyVnode = Mithril.Vnode<any, any> & {
    attrs?: Record<string, any>;
    children?: any;
};
/** Troca, no lugar, os `<i>` da árvore devolvida pelo `view()` (o ramon/marketplace usa o mesmo). */
export declare function lucidify(children: unknown): void;
/** "14:35" hoje; "13 out 14:35" em outro dia. */
export declare function messageTime(date: Date): string;
/** Acha o primeiro vnode com esta classe (a árvore de uma mensagem é pequena). */
export declare function findByClass(node: unknown, className: string): AnyVnode | null;
export default function installRamonChatViews(): void;
export {};
