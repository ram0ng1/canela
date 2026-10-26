export type BackgroundStyle = 'tinted' | 'gradient' | 'solid' | 'plain' | 'image';
export type BackgroundContext = 'forum' | 'auth';
export declare function forumBackground(): {
    style: BackgroundStyle;
    image: string | null;
};
export declare function authBackground(): {
    style: BackgroundStyle;
    image: string | null;
};
export declare function applyBackground(context: BackgroundContext): void;
