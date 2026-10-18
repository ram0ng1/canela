/*
 * Peças comuns dos emblemas: as configurações, o nome dos níveis, a ordem de
 * destaque e o cache das concessões de cada usuário.
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

import type Badge from './models/Badge';
import type UserBadge from './models/UserBadge';
import { forumBool, t } from '../../utils/settings';

export const badgesEnabled = () => forumBool('canelaBadgesEnabled', true);
export const trustLevelsEnabled = () => forumBool('canelaTrustLevelsEnabled', true);

/** Os níveis 0–4, na ordem; o índice é o nível. */
export const TRUST_LEVEL_NAMES = ['newuser', 'basic', 'member', 'regular', 'leader'] as const;

/** Os agrupamentos da página /badges, na ordem do Discourse. */
export const GROUPINGS = ['getting_started', 'community', 'posting', 'trust_level', 'other'] as const;

const TYPE_ORDER: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };

export function trustLevel(user: User | null | undefined): number | null {
  const level = user?.attribute<number | undefined>('trustLevel');

  return typeof level === 'number' ? level : null;
}

export function trustLevelName(level: number): string {
  return t(`badges.trust_levels.${TRUST_LEVEL_NAMES[level] ?? 'newuser'}`);
}

export function badgeUrl(badge: Badge, username?: string): string {
  const params: Record<string, string> = { id: badge.id()!, slug: badge.slug() };

  if (username) params.username = username;

  return app.route('canela.badge', params);
}

/**
 * Os emblemas de alguém sem repetição, na ordem de destaque do Discourse:
 * ouro, prata, bronze e, dentro de cada tipo, o mais recente primeiro. Cada um
 * leva quantas vezes foi ganho e a concessão mais recente.
 */
export function distinctBadges(userBadges: UserBadge[]): { badge: Badge; count: number; latest: UserBadge }[] {
  const byBadge = new Map<string, { badge: Badge; count: number; latest: UserBadge }>();

  userBadges.forEach((userBadge) => {
    const badge = userBadge.badge() as Badge | false;

    if (!badge) return;

    const entry = byBadge.get(badge.id()!);

    if (!entry) {
      byBadge.set(badge.id()!, { badge, count: 1, latest: userBadge });
    } else {
      entry.count++;
      if ((userBadge.grantedAt()?.getTime() ?? 0) > (entry.latest.grantedAt()?.getTime() ?? 0)) entry.latest = userBadge;
    }
  });

  return [...byBadge.values()].sort(
    (a, b) =>
      (TYPE_ORDER[a.badge.type()] ?? 3) - (TYPE_ORDER[b.badge.type()] ?? 3) ||
      (b.latest.grantedAt()?.getTime() ?? 0) - (a.latest.grantedAt()?.getTime() ?? 0)
  );
}

/**
 * Os campos que a grade de /badges desenha (BadgeCard + BadgeMedal): sem a
 * descrição longa e as colunas do admin, que a página do emblema pede no Show.
 * `src/Preload/PreloadContent.php` pré-carrega com os mesmos campos.
 */
export const LIST_FIELDS = 'slug,name,description,icon,imageUrl,type,grouping,grantCount';

/**
 * Os ids dos emblemas que alguém tem, para a marca de conquistado da grade:
 * só a ligação com o emblema, sem o usuário e sem os dados do emblema (que a
 * grade já pediu). Fora do cache de `loadUserBadges`, que guarda concessões
 * completas para o cartão e o resumo.
 */
export function loadOwnedBadgeIds(user: User): Promise<Set<string>> {
  return app.store
    .find<UserBadge[]>(
      'user-badges',
      { filter: { user: user.id()! }, page: { limit: 100, total: 0 }, include: 'badge', fields: { 'user-badges': 'badge', badges: 'slug' } } as any,
      undefined,
      { errorHandler: () => {} } as any
    )
    .then((result) => {
      const ids = new Set<string>();

      result.forEach((userBadge) => {
        const badge = userBadge.badge() as Badge | false;
        if (badge) ids.add(badge.id()!);
      });

      return ids;
    })
    .catch(() => new Set<string>());
}

/** Concessões já pedidas por usuário: o cartão, o resumo e a aba pedem as mesmas. */
const cache = new Map<string, Promise<UserBadge[]>>();

/** Até 100 concessões — o bastante para destacar e contar; a aba Emblemas pagina por conta própria. */
export function loadUserBadges(user: User, { refresh = false } = {}): Promise<UserBadge[]> {
  const key = user.id()!;

  if (refresh || !cache.has(key)) {
    const request = app.store
      .find<UserBadge[]>('user-badges', { filter: { user: key }, page: { limit: 100, total: 0 } } as any, undefined, {
        errorHandler: () => {},
      } as any)
      .then((result) => result.slice())
      .catch(() => {
        cache.delete(key);

        return [] as UserBadge[];
      });

    cache.set(key, request);
  }

  return cache.get(key)!;
}
