/*
 * O marcador no store (`bookmarks`), espelho do BookmarkResource do PHP.
 */
import Model from 'flarum/common/Model';
import type Post from 'flarum/common/models/Post';

export default class Bookmark extends Model {
  name() {
    return Model.attribute<string | null>('name').call(this);
  }

  reminderAt() {
    return Model.attribute<Date | null | undefined, string | null>('reminderAt', Model.transformDate).call(this);
  }

  remindedAt() {
    return Model.attribute<Date | null | undefined, string | null>('remindedAt', Model.transformDate).call(this);
  }

  createdAt() {
    return Model.attribute<Date | undefined, string>('createdAt', Model.transformDate).call(this);
  }

  updatedAt() {
    return Model.attribute<Date | undefined, string>('updatedAt', Model.transformDate).call(this);
  }

  post() {
    return Model.hasOne<Post>('post').call(this);
  }

  /** Lembrete marcado e ainda não enviado. */
  hasPendingReminder(): boolean {
    return !!this.reminderAt() && !this.remindedAt();
  }
}
