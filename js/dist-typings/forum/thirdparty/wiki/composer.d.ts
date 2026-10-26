/** Uma pergunta frequente sendo editada (`uid` só para a key do Mithril). */
interface FaqEntry {
    uid: number;
    question: string;
    answer: string;
}
/** O que o composer edita além do texto (o texto mora no ComposerState). */
export interface ArticleDraft {
    title: string;
    categoryId: string;
    slug: string;
    position: string;
    isDraft: boolean;
    faq: FaqEntry[];
    optionsOpen: boolean;
}
/**
 * Abre o composer do artigo: novo (sem `article`) ou editando. `article`
 * pode ser o modelo ou o id/slug; na edição o artigo vem de novo do
 * servidor, com o texto de origem (a lista não traz o `content`).
 */
export declare function openArticleComposer(article?: any): Promise<void>;
/**
 * O composer de comentário da wiki (o ComposerBody dela) ganha a linha da
 * ação, como a resposta de um tópico. A wiki lê `attrs.wikiHeaderItems`
 * depois do headerItems do ComposerBody, então trocar aqui vale para o
 * desenho.
 */
export declare function installCommentComposer(): void;
export {};
