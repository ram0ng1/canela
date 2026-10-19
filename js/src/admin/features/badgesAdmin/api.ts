/*
 * Acesso do admin de emblemas à API (`/api/canela-badges`, `/api/canela-user-badges`). O
 * admin não tem os modelos do fórum, então lê e grava o JSON:API direto.
 */
import app from 'flarum/admin/app';

import { trans } from '../../util';

export const KEY = 'ramon-canela.admin.settings.badges';

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
  user: { id: string; username: string; displayName: string; avatarUrl: string | null } | null;
}

export const TYPES = ['gold', 'silver', 'bronze'] as const;
export const GROUPINGS = ['getting_started', 'community', 'posting', 'trust_level', 'other'] as const;

export const apiUrl = () => ((app.forum.attribute<string>('apiUrl') as string) || '/api').replace(/\/+$/, '');

/** Os campos da migração do admin já existem (o servidor só os manda depois dela). */
export const hasAdminColumns = (badge?: BadgeRow | null) => !!badge && 'manualGrant' in badge.attributes;

/** O texto do primeiro erro de uma resposta 422, para mostrar dentro do modal. */
export function errorText(error: any): string {
  const detail = error?.response?.errors?.[0]?.detail;

  return typeof detail === 'string' && detail ? detail : trans(`${KEY}.request_failed`, 'Não deu certo. Tente de novo.');
}

/** Pedido sem o alerta automático do core: os modais mostram o erro no lugar. */
export function request<T = any>(options: Record<string, any>): Promise<T> {
  return app.request<T>({ errorHandler: () => {}, ...options } as any);
}

export function loadBadges(): Promise<BadgeRow[]> {
  return request<{ data: BadgeRow[] }>({ method: 'GET', url: `${apiUrl()}/canela-badges`, params: { sort: 'position' } }).then(
    (response) => response.data
  );
}

export function saveBadge(id: string | null, attributes: Partial<BadgeAttributes>): Promise<BadgeRow> {
  return request<{ data: BadgeRow }>({
    method: id ? 'PATCH' : 'POST',
    url: id ? `${apiUrl()}/canela-badges/${id}` : `${apiUrl()}/canela-badges`,
    body: { data: { type: 'canela-badges', ...(id ? { id } : {}), attributes } },
  }).then((response) => response.data);
}

export function deleteBadge(id: string): Promise<unknown> {
  return request({ method: 'DELETE', url: `${apiUrl()}/canela-badges/${id}` });
}

export function restoreSystemBadges(): Promise<number> {
  return request<{ meta: { restored: number } }>({ method: 'POST', url: `${apiUrl()}/canela-badges/restore-system` }).then(
    (response) => response.meta?.restored ?? 0
  );
}

export function grantBadge(badgeId: string, username: string, reason: string): Promise<unknown> {
  return request({ method: 'POST', url: `${apiUrl()}/canela-user-badges/grant`, body: { badgeId: Number(badgeId), username, reason } });
}

export function revokeGrant(id: string): Promise<unknown> {
  return request({ method: 'DELETE', url: `${apiUrl()}/canela-user-badges/${id}` });
}

/** Uma página de concessões de um emblema, com o usuário de cada uma. */
export function loadGrants(badgeId: string, offset: number): Promise<{ rows: GrantRow[]; hasMore: boolean }> {
  return request<any>({
    method: 'GET',
    url: `${apiUrl()}/canela-user-badges`,
    params: { filter: { badge: badgeId }, include: 'user', page: { offset, limit: 30 } },
  }).then((response) => {
    const users = new Map<string, any>();

    (response.included || []).forEach((item: any) => item.type === 'users' && users.set(item.id, item));

    const rows: GrantRow[] = (response.data || []).map((item: any) => {
      const user = users.get(item.relationships?.user?.data?.id);

      return {
        id: item.id,
        grantedAt: item.attributes.grantedAt,
        reason: item.attributes.reason ?? null,
        user: user
          ? { id: user.id, username: user.attributes.username, displayName: user.attributes.displayName, avatarUrl: user.attributes.avatarUrl }
          : null,
      };
    });

    return { rows, hasMore: !!response.links?.next };
  });
}

/** Sugestões para o campo de usuário (a busca de usuários do core). */
export function searchUsers(query: string): Promise<{ username: string; displayName: string }[]> {
  return request<any>({ method: 'GET', url: `${apiUrl()}/users`, params: { filter: { q: query }, page: { limit: 6 } } }).then((response) =>
    (response.data || []).map((user: any) => ({ username: user.attributes.username, displayName: user.attributes.displayName }))
  );
}
