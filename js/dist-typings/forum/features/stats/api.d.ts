export interface TopicCountsResponse {
    new: number;
    unread: number;
    limit: number;
}
/** Sem `tag`, conta o fórum todo; com ela, só a tag e as filhas. */
export declare function fetchTopicCounts(tag?: string): Promise<TopicCountsResponse | null>;
export interface ReadTimePayload {
    discussionId: string;
    seconds: number;
    postIds: string[];
}
export declare function sendReadTime(payload: ReadTimePayload): void;
