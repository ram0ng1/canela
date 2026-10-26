import Notification from 'flarum/forum/components/Notification';
export declare class PostEditedNotification extends Notification {
    icon(): string;
    href(): string;
    content(): string;
    excerpt(): string | null;
}
export declare class TopicLinkedNotification extends Notification {
    icon(): string;
    href(): string;
    content(): string;
    excerpt(): string | null;
}
export declare class InviteAcceptedNotification extends Notification {
    icon(): string;
    href(): string;
    content(): string;
    excerpt(): null;
}
export default function installGapNotifications(): void;
