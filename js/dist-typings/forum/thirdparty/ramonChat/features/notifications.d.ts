import Notification from 'flarum/forum/components/Notification';
interface ActivityData {
    channelId: number;
    threadId: number | null;
    messageId: number;
    channelName: string | null;
    isDirect: boolean;
    kind?: 'user' | 'here' | 'all';
}
declare abstract class ActivityNotification extends Notification {
    data(): ActivityData;
    icon(): string;
    href(): string;
    sender(): string;
    channelLabel(): string;
    excerpt(): string;
}
export declare class RamonChatMentionNotification extends ActivityNotification {
    icon(): string;
    content(): string;
}
export declare class RamonChatMessageNotification extends ActivityNotification {
    content(): string;
}
export default function installRamonChatNotifications(): void;
export {};
