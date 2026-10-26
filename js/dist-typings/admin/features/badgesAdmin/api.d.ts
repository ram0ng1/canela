export declare const KEY = "ramon-canela.admin.settings.badges";
export interface BadgeAttributes {
    slug: string;
    name: string;
    description: string | null;
    longDescription?: string | null;
    icon: string;
    /** Só depois da migração do admin de emblemas. */
    imageUrl?: string | null;
    type: 'gold' | 'silver' | 'bronze';
    grouping: string;
    position: number;
    multipleGrant: boolean;
    system: boolean;
    enabled: boolean;
    listable: boolean;
    allowTitle?: boolean;
    manualGrant?: boolean;
    automatic?: boolean;
    canGrant?: boolean;
    available?: boolean;
    grantCount: number;
}
export interface BadgeRow {
    id: string;
    attributes: BadgeAttributes;
}
export interface GrantRow {
    id: string;
    grantedAt: string | null;
    reason: string | null;
    user: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
    } | null;
}
export declare const TYPES: readonly ["gold", "silver", "bronze"];
export declare const GROUPINGS: readonly ["getting_started", "community", "posting", "trust_level", "other"];
export declare const apiUrl: () => string;
/** Os campos da migração do admin já existem (o servidor só os manda depois dela). */
export declare const hasAdminColumns: (badge?: BadgeRow | null) => boolean;
/** O texto do primeiro erro de uma resposta 422, para mostrar dentro do modal. */
export declare function errorText(error: any): string;
/** Pedido sem o alerta automático do core: os modais mostram o erro no lugar. */
export declare function request<T = any>(options: Record<string, any>): Promise<T>;
export declare function loadBadges(): Promise<BadgeRow[]>;
export declare function saveBadge(id: string | null, attributes: Partial<BadgeAttributes>): Promise<BadgeRow>;
export declare function deleteBadge(id: string): Promise<unknown>;
export declare function restoreSystemBadges(): Promise<number>;
export declare function grantBadge(badgeId: string, username: string, reason: string): Promise<unknown>;
export declare function revokeGrant(id: string): Promise<unknown>;
/** Uma página de concessões de um emblema, com o usuário de cada uma. */
export declare function loadGrants(badgeId: string, offset: number): Promise<{
    rows: GrantRow[];
    hasMore: boolean;
}>;
/** Sugestões para o campo de usuário (a busca de usuários do core). */
export declare function searchUsers(query: string): Promise<{
    username: string;
    displayName: string;
}[]>;
