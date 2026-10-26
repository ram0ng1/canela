export declare const thirdParty: {
    /** fof/best-answer: "✓ Solução" na barra do post e a resposta aceita sob o 1º post. */
    solved: () => boolean;
    /** fof/reactions: resumo dos emojis na barra do post. */
    reactions: () => boolean;
    /** fof/polls: a enquete em grade, com a contagem grande ao lado. */
    polls: () => boolean;
    /** fof/links: os links saem do cabeçalho e vão para a barra lateral. */
    linksSidebar: () => boolean;
    /** fof/upload: a barra "Enviando…" no editor. */
    uploadProgress: () => boolean;
    /** fof/discussion-thumbnail: a miniatura na lista de tópicos. */
    thumbnails: () => boolean;
    /** fof/forum-widgets-core: os widgets em cartões, numa coluna à direita da lista. */
    widgets: () => boolean;
    /**
     * forumaker/profile-cover: a capa da extensão no lugar da interna do tema
     * (perfil, cartão e o editor dela nas Configurações). A interna fica no banco.
     */
    profileCover: () => boolean;
    /** ramon/verified: o selo depois do nome, na linha do texto (post, cartão, perfil). */
    verified: () => boolean;
    /** linkrobins/wiki: índice, artigo e edição no padrão do tema, e o "Wiki" da barra lateral. */
    wiki: () => boolean;
    /** ramon/chat: o chat da extensão no visual do chat do tema (a chave geral). */
    ramonChat: () => boolean;
    /** ramon/chat: as seções "Canais" e "Mensagens diretas" na barra lateral do tema. */
    ramonChatSidebar: () => boolean;
    /** ramon/chat: a aba "Chat" no menu do usuário, com as notificações da extensão. */
    ramonChatNotifications: () => boolean;
    /**
     * ramon/chat: o botão "Chat" no cartão do usuário e no perfil. Nunca com o
     * flarum/messages ligado: aí a conversa privada é a "Mensagem" dele, e o
     * chat não oferece MD no perfil nem no cartão.
     */
    ramonChatUserButton: () => boolean;
    /** ramon/marketplace: a loja no visual do tema (páginas no cartão, títulos como os heros, ícones Lucide). */
    marketplace: () => boolean;
    /** ramon/marketplace: os links da loja como a seção recolhível "Loja" da barra lateral. */
    marketplaceSidebar: () => boolean;
};
/**
 * Módulo de uma extensão que pode estar desligada: nunca um `import` direto,
 * que quebraria o tema inteiro sem ela.
 */
export declare function extModule<T = any>(namespace: string, id: string): T | null;
