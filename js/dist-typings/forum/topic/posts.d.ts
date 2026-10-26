import PostModel from 'flarum/common/models/Post';
import { type ReactorEntry } from './components/WhoReactedPopover';
export default function installPosts(): void;
/**
 * Quem curtiu, para o popover: os que vieram com o post e, se a contagem diz
 * que há mais, a lista inteira pela API (o filtro `liked` do flarum/likes).
 */
export declare function likers(post: PostModel): Promise<ReactorEntry[]>;
