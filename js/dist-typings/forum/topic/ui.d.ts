export interface PostUi {
    likers: boolean;
    more: boolean;
    share: boolean;
    replies: boolean;
    parent: boolean;
    version: number;
    /** O "copiado" do botão de link some sozinho depois de um instante. */
    copiedTimer?: number;
    /** Quando o leitor curtiu: o coração bate só logo depois do clique. */
    likeBump?: number;
}
export declare function postUi(component: any): PostUi;
/** Inverte um painel do post e avisa o retainer. */
export declare function togglePostUi(ui: PostUi, key: 'likers' | 'more' | 'share' | 'replies' | 'parent', value?: boolean): void;
export declare const topicSettings: {
    timeline: () => boolean;
    footer: () => boolean;
    map: () => boolean;
    suggested: () => boolean;
    userCard: () => boolean;
    postActions: () => boolean;
    embeddedReplies: () => boolean;
    /** O "em resposta a" numa linha embaixo do nome, como no avocado (canela.topic_reply_to_style). */
    replyToLine: () => boolean;
    /** O nome de usuário antes do nome de exibição nas postagens (canela.post_username_first). */
    usernameFirst: () => boolean;
    newRepliesBar: () => boolean;
};
/** O controle de notificações do tópico só existe com o flarum/subscriptions e alguém logado. */
export declare function canSubscribe(): boolean;
/** Link absoluto, para copiar e compartilhar. */
export declare function absoluteUrl(path: string): string;
