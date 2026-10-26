import Model from 'flarum/common/Model';
import type Post from 'flarum/common/models/Post';
export default class Bookmark extends Model {
    name(): string | null;
    reminderAt(): Date | null | undefined;
    remindedAt(): Date | null | undefined;
    createdAt(): Date | undefined;
    updatedAt(): Date | undefined;
    post(): false | Post;
    /** Lembrete marcado e ainda não enviado. */
    hasPendingReminder(): boolean;
}
