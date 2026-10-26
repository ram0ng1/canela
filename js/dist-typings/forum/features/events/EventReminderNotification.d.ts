import Notification from 'flarum/forum/components/Notification';
import type Discussion from 'flarum/common/models/Discussion';
export default class EventReminderNotification extends Notification {
    icon(): string;
    discussion(): Discussion | null;
    href(): string;
    content(): string;
    excerpt(): null;
}
