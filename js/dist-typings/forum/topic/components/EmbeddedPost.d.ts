import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Post from 'flarum/common/models/Post';
export interface EmbeddedPostAttrs extends ComponentAttrs {
    post: Post;
    /** Para onde aponta o link de ir ao post: acima (respondido) ou abaixo (resposta). */
    direction: 'up' | 'down';
    className?: string;
}
export default class EmbeddedPost extends Component<EmbeddedPostAttrs> {
    view(): JSX.Element;
}
/** Busca, numa requisição só, os posts que vieram sem o HTML. */
export declare function loadMissingContent(posts: Post[]): Promise<unknown>;
export declare function embeddedLoading(): JSX.Element;
