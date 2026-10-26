import { BooleanGambit, KeyValueGambit } from 'flarum/common/query/IGambit';
/** Os booleanos do tema moram no grupo `em:`/`in:`, e não no `é:` do core. */
declare abstract class InGambit extends BooleanGambit {
    groupKey(): string;
    enabled(): boolean;
}
export declare class InTitleGambit extends InGambit {
    key(): string;
    filterKey(): string;
}
export declare class LikedGambit extends InGambit {
    key(): string;
    filterKey(): string;
    enabled(): boolean;
}
export declare class BookmarkedGambit extends InGambit {
    key(): string;
    filterKey(): string;
    enabled(): boolean;
}
export declare class MinPostsGambit extends KeyValueGambit {
    key(): string;
    hint(): string;
    valuePattern(): string;
    filterKey(): string;
    enabled(): boolean;
}
export default function installGambits(): void;
export {};
