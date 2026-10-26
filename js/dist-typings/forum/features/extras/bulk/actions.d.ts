import type Discussion from 'flarum/common/models/Discussion';
type Moderatable = Discussion & Record<string, any>;
export interface BulkAction {
    key: string;
    icon: string;
    label: string;
    /** O tópico aceita a ação? (permissão e estado atual) */
    applies: (discussion: Moderatable) => boolean;
    run: (discussions: Moderatable[]) => Promise<void> | void;
    danger?: boolean;
}
export declare function bulkActions(): BulkAction[];
export {};
