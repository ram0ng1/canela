/*
 * Os formatos que a API do chat (/api/chat/*) devolve. São objetos simples,
 * e não modelos do store: o chat muda o tempo todo (mensagens, reações,
 * contagens), e o front mexe neles direto ao receber cada evento. Os usuários,
 * esses sim, vão para o store do Flarum (Avatar, nome, perfil).
 */

export type ChannelStatus = 'open' | 'read_only' | 'closed' | 'archived';

export type NotificationLevel = 'never' | 'mention' | 'always';

export type ThreadLevel = 'muted' | 'regular' | 'tracking' | 'watching';

export interface ChatTag {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
}

export interface ChatMembership {
  following: boolean;
  muted: boolean;
  notificationLevel: NotificationLevel;
  starred: boolean;
  lastReadMessageId: number | null;
  lastViewedAt: string | null;
  unreadCount: number;
  mentionCount: number;
  unreadThreadsCount: number;
  hasUnseenPins: boolean;
}

export interface ChatChannel {
  id: number;
  type: 'public' | 'direct';
  isGroup: boolean;
  name: string | null;
  slug: string;
  description: string | null;
  emoji: string | null;
  tag: ChatTag | null;
  status: ChannelStatus;
  threadingEnabled: boolean;
  allowChannelWideMentions: boolean;
  autoJoin: boolean;
  userCount: number;
  messagesCount: number;
  lastMessageId: number | null;
  lastMessage: { id: number; userId: number | null; excerpt: string; createdAt: string } | null;
  participantIds: number[];
  createdAt: string;
  canModerate: boolean;
  canPost: boolean;
  cannotPostReason: string | null;
  canPin: boolean;
  canEdit: boolean;
  canAddMembers: boolean;
  membership: ChatMembership | null;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  userIds: number[];
}

export interface ChatUpload {
  id: number;
  url: string;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
}

export interface ChatThreadPreview {
  id: number;
  title: string | null;
  replyCount: number;
  lastReplyId: number | null;
  lastReplyUserId: number | null;
  lastReplyExcerpt: string;
  lastReplyCreatedAt: string | null;
  participantIds: number[];
  participantCount: number;
}

export interface ChatMessage {
  id: number;
  channelId: number;
  threadId: number | null;
  isThreadOriginal: boolean;
  userId: number | null;
  message: string;
  cooked: string;
  excerpt: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  deletedById: number | null;
  inReplyTo: { id: number; userId: number | null; excerpt: string; deleted: boolean } | null;
  reactions: ChatReaction[];
  uploads: ChatUpload[];
  pinned: boolean;
  pinnedById: number | null;
  pinnedAt: string | null;
  thread: ChatThreadPreview | null;

  // Só do front: a mensagem enviada que ainda não voltou do servidor, a que
  // falhou, e a apagada que o leitor abriu.
  staged?: boolean;
  error?: string | null;
  expanded?: boolean;
  stagedKey?: string;
}

export interface ChatThread extends ChatThreadPreview {
  channelId: number;
  originalMessage: ChatMessage | null;
  membership: { notificationLevel: ThreadLevel; lastReadMessageId: number | null; unreadCount: number } | null;
}

/** O `canelaChat` do payload do fórum. */
export interface ChatCapabilities {
  enabled: boolean;
  allowed?: boolean;
  canUse?: boolean;
  canDirectMessage?: boolean;
  canCreateChannel?: boolean;
  canModerate?: boolean;
  threads?: boolean;
  uploads?: boolean;
  pins?: boolean;
  sidebar?: boolean;
  maxMessageLength?: number;
  dmMaxUsers?: number;
  uploadMaxKb?: number;
  pollSeconds?: number;
  retentionDays?: number;
  dmRetentionDays?: number;
  realtime?: boolean;
}

/** O evento `canelaChat` que chega pelo websocket. */
export interface ChatEvent {
  type: string;
  channelId: number;
  messageId?: number;
  threadId?: number | null;
  userId?: number;
  emoji?: string;
  action?: 'add' | 'remove';
  typing?: boolean;
  username?: string;
  pinned?: boolean;
  deletedById?: number;
  deletedAt?: string;
  lastReadMessageId?: number;
  mentionedUserIds?: number[];
  refetch?: boolean;
}

/** As "rotas" da gaveta e da página cheia. */
export type ChatRoute =
  | { name: 'channels' }
  | { name: 'direct-messages' }
  | { name: 'threads' }
  | { name: 'search' }
  | { name: 'browse'; filter?: string }
  | { name: 'new-message' }
  | { name: 'channel'; channelId: number; messageId?: number }
  | { name: 'thread'; channelId: number; threadId: number; messageId?: number }
  | { name: 'channel-threads'; channelId: number }
  | { name: 'channel-pins'; channelId: number }
  | { name: 'channel-info'; channelId: number; tab: 'settings' | 'members' };
