import type { CardDef, GroupKey } from '../types';
export interface GroupDef {
    key: GroupKey;
    icon: string;
    label: () => string;
    description: () => string;
}
export declare const GROUPS: GroupDef[];
export declare function createPanel(cards: CardDef[]): any;
