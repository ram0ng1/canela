export declare class ReadTracker {
    private readonly currentDiscussionId;
    private interval;
    private lastActivity;
    private ticks;
    private seconds;
    private discussionId;
    /** id da postagem → segundos à vista, até virar lida. */
    private exposure;
    private pending;
    /** Já enviadas nesta visita à página: não contam duas vezes. */
    private sent;
    constructor(currentDiscussionId: () => string | null);
    private readonly onActivity;
    private readonly onVisibility;
    start(): void;
    stop(): void;
    private tick;
    private collectVisiblePosts;
    flush(): void;
}
export declare function activityEnabled(): boolean;
export default function installReadTracker(): void;
