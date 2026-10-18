/*
 * Acesso aos endpoints das páginas de comunidade (/api/canela-about,
 * /api/canela-directory, /api/canela-groups/:id/activity).
 *
 * Eles não são recursos do JSON:API — o "Sobre" junta números, texto e
 * equipe numa resposta só —, mas os usuários vêm no formato de recurso
 * (`type: users`) e entram no store. Assim o Avatar, o `username()` e as
 * rotas de perfil do core funcionam com eles como com qualquer outro usuário.
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

export type PeriodKey = 'all' | 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'daily';

export const PERIODS: PeriodKey[] = ['all', 'yearly', 'quarterly', 'monthly', 'weekly', 'daily'];

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

function apiUrl(path: string): string {
  return `${(app.forum.attribute<string>('apiUrl') || '/api').replace(/\/+$/, '')}${path}`;
}

/** Põe no store os usuários que vieram junto e devolve os modelos por id. */
export function pushUsers(resources: any[]): Record<string, User> {
  const users: Record<string, User> = {};

  resources.forEach((resource) => {
    const user = app.store.pushObject<User>(resource);
    if (user) users[resource.id] = user;
  });

  return users;
}

export function fetchAbout(): Promise<AboutPayload> {
  return app.request<AboutPayload>({ method: 'GET', url: apiUrl('/canela-about') });
}

export function fetchDirectory(params: DirectoryParams): Promise<DirectoryPayload> {
  // Parâmetros vazios ficam de fora: a URL da API é a mesma que um link
  // salvo produziria, e o servidor aplica os padrões.
  const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== null));

  return app.request<DirectoryPayload>({ method: 'GET', url: apiUrl('/canela-directory'), params: query });
}

export function fetchGroupActivity(groupId: string, page: number): Promise<{ data: string[]; meta: { page: number; hasMore: boolean } }> {
  return app.request({ method: 'GET', url: apiUrl(`/canela-groups/${groupId}/activity`), params: { page } });
}
