import Notification from 'flarum/forum/components/Notification';
import { type DialogMessage } from './util';
export default class MessageReactedNotification extends Notification {
    icon(): string;
    message(): DialogMessage | null;
    href(): string;
    content(): string;
    excerpt(): string | null;
}
