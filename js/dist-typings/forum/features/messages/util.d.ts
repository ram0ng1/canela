import type User from 'flarum/common/models/User';
import type Group from 'flarum/common/models/Group';
import type Model from 'flarum/common/Model';
/** O modelo `dialogs` do flarum/messages, só com o que o tema usa. */
export type Dialog = Model & {
    title(): string;
    lastMessageAt(): Date | undefined;
    createdAt(): Date | undefined;
    users(): (User | undefined)[] | false;
    firstMessage(): DialogMessage | false | undefined;
    lastMessage(): DialogMessage | false | undefined;
    unreadCount(): number | undefined;
    lastReadMessageId(): number | undefined;
    canSendMessage(): boolean | undefined;
    recipient(): User | null | undefined;
    messageRelationshipId(name: 'firstMessage' | 'lastMessage'): string | undefined;
};
export type DialogMessage = Model & {
    number(): number;
    contentPlain(): string | null | undefined;
    createdAt(): Date;
    user(): User | false | undefined;
    dialog(): Dialog | false | undefined;
};
export type Box = 'inbox' | 'sent' | 'new' | 'unread' | 'archive' | 'group';
/** As abas, na ordem. */
export declare const BOXES: Box[];
/** O flarum/messages está ligado e o visual de mensagens do tema também. */
export declare function messagesOn(): boolean;
/**
 * O backend do tema (extend/messages.php) está carregado: caixas, arquivo,
 * título e "sair". Sem ele, só o que o flarum/messages faz sozinho.
 */
export declare function boxesOn(): boolean;
/** As caixas que dá para mostrar agora (sem o backend, só as do flarum/messages). */
export declare function availableBoxes(): Box[];
/**
 * A caixa da equipe (backend do tema, migration de grupos): o grupo, se quem
 * vê é da equipe, e alguém dela para receber a mensagem "à equipe".
 */
export declare function messageGroup(): {
    id: number;
    member: boolean;
    contactUserId: number | null;
} | null;
/** O grupo (modelo) da caixa da equipe, do store (o fórum já traz os grupos). */
export declare function messageGroupModel(): Group | null;
/** O nome do grupo no chip (o plural do grupo). */
export declare function groupLabel(group: Group): string;
/** A rota da aba "Mensagens" do perfil, existindo. */
export declare function hasProfileRoute(): boolean;
/**
 * O endereço de uma caixa. `/u/:username/messages/:box` só abre direto com o
 * backend do tema (a rota do PHP é dele); sem ele a caixa vai na query.
 */
export declare function boxHref(user: User, box?: Box): string;
/** "Minhas mensagens": a caixa de entrada de quem está logado. */
export declare function myMessagesHref(): string;
/** O endereço de uma conversa (o "tópico" da mensagem). */
export declare function dialogHref(dialog: Dialog, near?: number): string;
/** O título do tópico de mensagem: o do composer ou o "Conversando com X". */
export declare function dialogTitle(dialog: Dialog): string;
export declare function isArchived(dialog: Dialog): boolean;
/** Os participantes, sem os que sumiram do store (conta excluída). */
export declare function participants(dialog: Dialog): User[];
/**
 * A conversa com o usuário do sistema (as mensagens automáticas): só de ida,
 * ninguém lê a caixa dele, então ela não tem resposta.
 */
export declare function isSystemDialog(dialog: Dialog): boolean;
/**
 * "Novo (n)" e "Não lidos (n)". Com o backend do tema vêm separados e sem o
 * arquivo; sem ele, o flarum/messages só sabe o total de conversas com não
 * lidas, que fica todo em "Não lidos".
 */
export declare function boxCounts(): {
    new: number;
    unread: number;
    group: number;
};
/** O total que "Minhas mensagens" e a "Caixa de entrada" mostram. */
export declare function totalUnread(): number;
/** As visualizações da conversa; `null` sem a contagem no banco. */
export declare function dialogViews(dialog: Dialog): number | null;
/**
 * Os grupos da equipe (administradores e moderadores) dos outros
 * participantes: o chip "👥 moderators" sob o título. No flarum/messages a
 * conversa é entre pessoas, então o chip diz de que equipe é quem está nela.
 */
export declare function staffGroups(dialog: Dialog): Group[];
/** O número de mensagens da conversa: o `number` da última, que é sequencial. */
export declare function messageCount(dialog: Dialog): number;
/**
 * Importa um componente carregado sob demanda já no formato `{ default }` que
 * o `composer.load` espera. O `asyncModuleImport` devolve a própria classe
 * quando o módulo já está registrado — e uma classe que herda do ComposerBody
 * herda também o `default` estático que o core pendura nele, apontando para o
 * ComposerBody: o composer abria vazio, com o corpo errado.
 */
export declare function lazyComponent(path: string): Promise<{
    default: any;
}>;
/**
 * Abre o composer de mensagem do flarum/messages (o MessageComposer vem num
 * pedaço carregado sob demanda, como o ComposerBody do core).
 */
export declare function openMessageComposer(attrs?: Record<string, unknown>): Promise<unknown>;
/** Quem pode começar uma mensagem (a permissão do flarum/messages). */
export declare function canSendMessages(): boolean;
/**
 * "Mensagem a um membro da equipe": abre a mensagem nova já endereçada ao
 * grupo da equipe (o chip do grupo no destinatário). Sem a caixa da equipe,
 * leva para a lista da equipe no Sobre.
 */
export declare function messageStaff(event?: Event): void;
