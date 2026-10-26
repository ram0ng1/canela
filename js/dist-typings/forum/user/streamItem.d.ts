import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';
export interface StreamItemOptions {
    className?: string;
    /** Entre o cabeçalho e o trecho (a reação da aba Reações). */
    extra?: Mithril.Children;
}
export default function streamItem(post: Post, options?: StreamItemOptions): Mithril.Children;
