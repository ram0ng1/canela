import Model from 'flarum/common/Model';
import type User from 'flarum/common/models/User';
import type Post from 'flarum/common/models/Post';
import type Badge from './Badge';
/** Uma concessão (`/api/canela-user-badges`): quem ganhou, qual emblema, por qual postagem. */
export default class UserBadge extends Model {
    grantedAt(): Date | null;
    /** Motivo ou link de uma concessão manual. */
    reason(): string | null | undefined;
    user(): false | User;
    badge(): false | Badge;
    post(): false | Post;
}
