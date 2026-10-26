import type Discussion from 'flarum/common/models/Discussion';
export interface TopicLink {
    url: string;
    title: string | null;
    domain: string;
    postId: string;
    postNumber: number;
    clicks: number;
}
export interface DiscussionLinks {
    /** Links externos distintos no tópico. */
    total: number;
    /** Os mais clicados primeiro. */
    top: TopicLink[];
    /** id da postagem → endereço → cliques (só os com clique). */
    posts: Record<string, Record<string, number>>;
}
export declare function linksEnabled(): boolean;
export declare function discussionLinks(discussion: Discussion | null | undefined | false): DiscussionLinks | null;
/** Http(s) e para fora do fórum: os únicos que o servidor conta. */
export declare function isExternalUrl(href: string | null): href is string;
/**
 * Manda o clique e soma 1 no número da página (o servidor descarta o
 * repetido em 24 horas; aqui o mesmo vale enquanto a página não recarrega).
 */
export declare function trackClick(postId: string, url: string, discussion?: Discussion | null): void;
