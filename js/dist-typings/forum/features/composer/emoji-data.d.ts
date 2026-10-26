export type EmojiRow = [string, string, string, string?];
export interface EmojiGroup {
    key: string;
    emoji: EmojiRow[];
}
declare const EMOJI_GROUPS: EmojiGroup[];
export default EMOJI_GROUPS;
