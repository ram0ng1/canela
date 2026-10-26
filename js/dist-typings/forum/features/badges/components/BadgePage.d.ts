import type Mithril from 'mithril';
import BadgesBasePage from './BadgesBasePage';
import type Badge from '../models/Badge';
import type UserBadge from '../models/UserBadge';
/**
 * A página de um emblema (/badges/:id/:slug): a medalha grande, o texto longo
 * e quem ganhou, dos mais recentes aos mais antigos. Com `?username=`, vinda
 * do perfil ou de uma notificação, a pessoa aparece em destaque na lista.
 */
export default class BadgePage extends BadgesBasePage {
    badge: Badge | null;
    grants: UserBadge[];
    loading: boolean;
    hasMore: boolean;
    failed: boolean;
    oninit(vnode: Mithril.Vnode<any, this>): void;
    loadGrants(badgeId: string, offset: number): void;
    title(): string;
    className(): string;
    content(): Mithril.Children;
    grantList(): Mithril.Children;
    /** O motivo de uma concessão manual: link (só http/https) ou texto. */
    reason(grant: UserBadge): Mithril.Children;
    grantItem(grant: UserBadge, highlighted: string): Mithril.Children;
}
