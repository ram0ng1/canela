import Model from 'flarum/common/Model';
import type User from 'flarum/common/models/User';
import type Post from 'flarum/common/models/Post';

import type Badge from './Badge';

/** Uma concessão (`/api/canela-user-badges`): quem ganhou, qual emblema, por qual postagem. */
export default class UserBadge extends Model {
  grantedAt() {
    return Model.attribute<Date | null, string | null>('grantedAt', Model.transformDate).call(this);
  }
  /** Motivo ou link de uma concessão manual. */
  reason() {
    return Model.attribute<string | null | undefined>('reason').call(this);
  }
  user() {
    return Model.hasOne<User>('user').call(this);
  }
  badge() {
    return Model.hasOne<Badge>('badge').call(this);
  }
  post() {
    return Model.hasOne<Post>('post').call(this);
  }
}
