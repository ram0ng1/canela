import type Mithril from 'mithril';
export declare function starredIds(): number[];
export declare function isStarred(channelId: number | string): boolean;
export declare function toggleStar(channelId: number | string): Promise<unknown>;
/** Os favoritos primeiro, mantendo a ordem do ramon/chat dentro de cada grupo. */
export declare function sortStarred<T extends {
    id(): string | undefined;
}>(channels: T[]): T[];
export declare function starSuffix(channel: {
    id(): string | undefined;
}): Mithril.Children;
