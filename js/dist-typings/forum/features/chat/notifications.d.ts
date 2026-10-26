import Notification from 'flarum/forum/components/Notification';
interface MentionData {
    channelId: number;
    messageId: number;
    threadId: number | null;
    channelTitle: string;
    slug: string;
    kind: 'user' | 'here' | 'all';
}
interface MessageData {
    channelId: number;
    slug: string;
    isDirect: boolean;
    name: string | null;
}
export declare class ChatMentionNotification extends Notification {
    data(): MentionData;
    icon(): string;
    href(): string;
    content(): string;
    excerpt(): null;
}
export declare class ChatMessageNotification extends Notification {
    data(): MessageData;
    icon(): string;
    href(): string;
    content(): string;
    excerpt(): null;
}
export {};
