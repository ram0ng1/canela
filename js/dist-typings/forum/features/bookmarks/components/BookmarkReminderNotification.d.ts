import Notification from 'flarum/forum/components/Notification';
import type Post from 'flarum/common/models/Post';
export default class BookmarkReminderNotification extends Notification {
    icon(): string;
    post(): Post | null;
    href(): string;
    content(): string;
    excerpt(): string | null;
}
