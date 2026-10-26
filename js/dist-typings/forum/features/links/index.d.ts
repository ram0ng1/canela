import type Post from 'flarum/common/models/Post';
export { discussionLinks, linksEnabled, trackClick } from './data';
export type { DiscussionLinks, TopicLink } from './data';
export default function installLinks(): void;
/** Põe, atualiza ou tira o número ao lado de cada link do post. */
export declare function decorateBody(body: HTMLElement, post: Post): void;
