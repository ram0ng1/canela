import type Mithril from 'mithril';
declare const PATHS: Record<string, string>;
export type UserMenuIconName = keyof typeof PATHS;
export declare function menuIcon(name: string): Mithril.Children;
export {};
