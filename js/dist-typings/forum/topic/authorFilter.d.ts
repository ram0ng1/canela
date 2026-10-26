import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';
/** Acima disso carregar tudo de uma vez pesaria demais: o filtro não aparece. */
export declare const AUTHOR_FILTER_MAX_POSTS = 500;
export declare const authorFilter: {
    discussionId: string | null;
    user: User | null;
    count: number;
    loading: boolean;
};
/** Quantos posts (comentários visíveis) a pessoa tem entre os já carregados do tópico. */
export declare function authorPostCount(discussion: Discussion, user: User): number;
export declare function filterByAuthor(stream: any, discussion: Discussion, user: User): void;
export declare function clearAuthorFilter(): void;
export default function installAuthorFilter(): void;
