import type User from 'flarum/common/models/User';
import type Post from 'flarum/common/models/Post';
import type { ApiResponsePlural } from 'flarum/common/Store';
export type PeriodKey = 'all' | 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'daily';
export declare const PERIODS: PeriodKey[];
export type StatPeriod = 'day' | 'week' | 'month' | 'all';
export interface AboutPayload {
    aboutHtml: string | null;
    contactEmail: string | null;
    contactUrl: string | null;
    members: number;
    createdAt: string | null;
    adminCount: number | null;
    moderatorCount: number | null;
    admins: string[] | null;
    moderators: string[] | null;
    stats: Record<string, Record<StatPeriod, number | null>> | null;
    cachedAt: string;
    included: any[];
}
export interface DirectoryRow {
    user: string;
    topicCount?: number;
    postCount?: number;
    likesReceived?: number;
    likesGiven?: number;
    /** null: a pessoa esconde que está online e quem vê não tem `viewLastSeenAt`. */
    daysVisited?: number | null;
    postsRead?: number | null;
}
export interface DirectoryPayload {
    data: DirectoryRow[];
    included: any[];
    meta: {
        columns: string[];
        /** As colunas que quem vê pode usar para ordenar (presença exige `viewLastSeenAt`). */
        sortable?: string[];
        period: PeriodKey;
        order: string;
        dir: 'asc' | 'desc';
        page: number;
        perPage: number;
        total: number;
        hasMore: boolean;
    };
}
export interface DirectoryParams {
    period?: PeriodKey;
    order?: string;
    dir?: 'asc' | 'desc';
    q?: string;
    page?: number;
    group?: string;
}
/** Põe no store os usuários que vieram junto e devolve os modelos por id. */
export declare function pushUsers(resources: any[]): Record<string, User>;
export declare function fetchAbout(): Promise<AboutPayload>;
export declare function fetchDirectory(params: DirectoryParams): Promise<DirectoryPayload>;
/** Postagens por página na aba "Atividade" do grupo. */
export declare const GROUP_ACTIVITY_PAGE = 20;
/**
 * A aba "Atividade" do grupo: o /api/posts do core com o filtro
 * `canelaGroup` (GroupActivityFilter no PHP), da mais nova para a mais
 * antiga. Cada postagem chega com tudo o que as extensões acrescentam, e
 * `links.next` diz se há mais.
 */
export declare function fetchGroupActivity(groupId: string, offset: number): Promise<ApiResponsePlural<Post>>;
