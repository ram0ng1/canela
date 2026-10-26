export interface Shortcut {
    keys: string[];
    action: string;
}
export interface ShortcutGroup {
    name: string;
    shortcuts: Shortcut[];
}
export declare const SHORTCUT_GROUPS: ShortcutGroup[];
export default function installShortcuts(): void;
