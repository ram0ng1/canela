/*
 * Chaves do admin para a integração com extensões de terceiros. Todas valem
 * `true` até o servidor dizer o contrário, então a integração funciona mesmo
 * antes de a configuração existir no extend.php.
 */
import { forumBool, isExtensionEnabled } from '../utils/settings';

export const thirdParty = {
  /** fof/best-answer: "✓ Solução" na barra do post e a resposta aceita sob o 1º post. */
  solved: () => isExtensionEnabled('fof-best-answer') && forumBool('canelaThirdPartySolved', true),
  /** fof/reactions: resumo dos emojis na barra do post. */
  reactions: () => isExtensionEnabled('fof-reactions') && forumBool('canelaThirdPartyReactions', true),
  /** fof/polls: a enquete em grade, com a contagem grande ao lado. */
  polls: () => isExtensionEnabled('fof-polls') && forumBool('canelaThirdPartyPolls', true),
  /** fof/links: os links saem do cabeçalho e vão para a barra lateral. */
  linksSidebar: () => isExtensionEnabled('fof-links') && forumBool('canelaThirdPartyLinksSidebar', true),
  /** fof/upload: a barra "Enviando…" no editor. */
  uploadProgress: () => isExtensionEnabled('fof-upload') && forumBool('canelaThirdPartyUploadProgress', true),
  /** fof/discussion-thumbnail: a miniatura na lista de tópicos. */
  thumbnails: () => isExtensionEnabled('fof-discussion-thumbnail') && forumBool('canelaThirdPartyThumbnails', true),
  /** fof/forum-widgets-core: os widgets em cartões, numa coluna à direita da lista. */
  widgets: () => isExtensionEnabled('fof-forum-widgets-core') && forumBool('canelaThirdPartyWidgets', true),
  /**
   * forumaker/profile-cover: a capa da extensão no lugar da interna do tema
   * (perfil, cartão e o editor dela nas Configurações). A interna fica no banco.
   */
  profileCover: () => isExtensionEnabled('forumaker-profile-cover') && forumBool('canelaThirdPartyProfileCover', true),
  /** ramon/verified: o selo depois do nome, na linha do texto (post, cartão, perfil). */
  verified: () => isExtensionEnabled('ramon-verified') && forumBool('canelaThirdPartyVerified', true),
  /** linkrobins/wiki: índice, artigo e edição no padrão do tema, e o "Wiki" da barra lateral. */
  wiki: () => isExtensionEnabled('linkrobins-wiki') && forumBool('canelaThirdPartyWiki', true),
  /** ramon/chat: o chat da extensão no visual do chat do tema (a chave geral). */
  ramonChat: () => isExtensionEnabled('ramon-chat') && forumBool('canelaThirdPartyRamonChat', true),
  /** ramon/chat: as seções "Canais" e "Mensagens diretas" na barra lateral do tema. */
  ramonChatSidebar: () => thirdParty.ramonChat() && forumBool('canelaThirdPartyRamonChatSidebar', true),
  /** ramon/chat: a aba "Chat" no menu do usuário, com as notificações da extensão. */
  ramonChatNotifications: () => thirdParty.ramonChat() && forumBool('canelaThirdPartyRamonChatNotifications', true),
  /**
   * ramon/chat: o botão "Chat" no cartão do usuário e no perfil. Nunca com o
   * flarum/messages ligado: aí a conversa privada é a "Mensagem" dele, e o
   * chat não oferece MD no perfil nem no cartão.
   */
  ramonChatUserButton: () =>
    thirdParty.ramonChat() && !isExtensionEnabled('flarum-messages') && forumBool('canelaThirdPartyRamonChatUserButton', true),
  /** ramon/marketplace: a loja no visual do tema (páginas no cartão, títulos como os heros, ícones Lucide). */
  marketplace: () => isExtensionEnabled('ramon-marketplace') && forumBool('canelaThirdPartyMarketplace', true),
  /** ramon/marketplace: os links da loja como a seção recolhível "Loja" da barra lateral. */
  marketplaceSidebar: () => thirdParty.marketplace() && forumBool('canelaThirdPartyMarketplaceSidebar', true),
};

/**
 * Módulo de uma extensão que pode estar desligada: nunca um `import` direto,
 * que quebraria o tema inteiro sem ela.
 */
export function extModule<T = any>(namespace: string, id: string): T | null {
  if (!isExtensionEnabled(namespace)) return null;

  return ((flarum as any).reg.checkModule(namespace, id) as T) || null;
}
