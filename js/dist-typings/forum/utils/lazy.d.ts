import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
type Loaded = Mithril.ComponentTypes<any, any>;
/**
 * Um componente que desenha `placeholder` até o chunk chegar e, daí em
 * diante, o componente de verdade com os mesmos atributos e filhos.
 * Se o download falhar, tenta de novo na próxima vez que aparecer.
 */
export declare function lazyComponent<Attrs extends ComponentAttrs = any>(load: () => Promise<Loaded>, placeholder?: () => Mithril.Children): typeof Component<Attrs>;
export {};
