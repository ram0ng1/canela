export type SidebarSectionName = 'categories' | 'tags';
export declare function getSidebarPicks(section: SidebarSectionName): string[] | null;
export declare function setSidebarPicks(section: SidebarSectionName, ids: string[] | null): void;
export declare function getCommunityMore(): string[];
export declare function setCommunityMore(keys: string[]): void;
export declare function getCommunityOrder(): string[];
export declare function setCommunityOrder(keys: string[]): void;
