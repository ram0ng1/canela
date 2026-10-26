import type User from 'flarum/common/models/User';
import type Badge from './models/Badge';
import type UserBadge from './models/UserBadge';
export declare const badgesEnabled: () => boolean;
export declare const trustLevelsEnabled: () => boolean;
/** Os níveis 0–4, na ordem; o índice é o nível. */
export declare const TRUST_LEVEL_NAMES: readonly ["newuser", "basic", "member", "regular", "leader"];
/** Os agrupamentos da página /badges, na ordem. */
export declare const GROUPINGS: readonly ["getting_started", "community", "posting", "trust_level", "other"];
export declare function trustLevel(user: User | null | undefined): number | null;
export declare function trustLevelName(level: number): string;
export declare function badgeUrl(badge: Badge, username?: string): string;
/**
 * Os emblemas de alguém sem repetição, na ordem de destaque:
 * ouro, prata, bronze e, dentro de cada tipo, o mais recente primeiro. Cada um
 * leva quantas vezes foi ganho e a concessão mais recente.
 */
export declare function distinctBadges(userBadges: UserBadge[]): {
    badge: Badge;
    count: number;
    latest: UserBadge;
}[];
/**
 * Os campos que a grade de /badges desenha (BadgeCard + BadgeMedal): sem a
 * descrição longa e as colunas do admin, que a página do emblema pede no Show.
 * `src/Preload/PreloadContent.php` pré-carrega com os mesmos campos.
 */
export declare const LIST_FIELDS = "slug,name,description,icon,imageUrl,type,grouping,grantCount";
/**
 * Os ids dos emblemas que alguém tem, para a marca de conquistado da grade:
 * só a ligação com o emblema, sem o usuário e sem os dados do emblema (que a
 * grade já pediu). Fora do cache de `loadUserBadges`, que guarda concessões
 * completas para o cartão e o resumo.
 */
export declare function loadOwnedBadgeIds(user: User): Promise<Set<string>>;
/** Até 100 concessões — o bastante para destacar e contar; a aba Emblemas pagina por conta própria. */
export declare function loadUserBadges(user: User, { refresh }?: {
    refresh?: boolean | undefined;
}): Promise<UserBadge[]>;
