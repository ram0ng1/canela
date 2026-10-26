import type User from 'flarum/common/models/User';
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
    daysVisited?: number;
    postsRead?: number;
}
export interface DirectoryPayload {
    data: DirectoryRow[];
    included: any[];
    meta: {
        columns: string[];
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
export declare function fetchGroupActivity(groupId: string, page: number): Promise<{
    data: string[];
    meta: {
        page: number;
        hasMore: boolean;
    };
}>;
