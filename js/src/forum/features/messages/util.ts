/*
 * Peças comuns das mensagens: se o recurso vale, as caixas, os links do
 * perfil e o que a conversa do flarum/messages tem a mais pelo tema.
 *
 * O flarum/messages é opcional e os módulos dele não são importados com
 * `ext:` (o tema quebraria sem ele): as conversas são lidas pelos próprios
 * métodos do modelo, que existem quando ele está ligado, e os componentes
 * carregados sob demanda são estendidos pelo nome do módulo.
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';
import type Group from 'flarum/common/models/Group';
import type Model from 'flarum/common/Model';

import { forumBool, isExtensionEnabled, t } from '../../utils/settings';

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

/** As abas na ordem do Discourse (`user-private-messages/user.gjs`). */
export const BOXES: Box[] = ['inbox', 'sent', 'new', 'unread', 'archive'];

/** O flarum/messages está ligado e o visual de mensagens do tema também. */
export function messagesOn(): boolean {
  return isExtensionEnabled('flarum-messages') && !!(app as any).dialogs && forumBool('canelaMessagesEnabled', true);
}

/**
 * O backend do tema (extend/messages.php) está carregado: caixas, arquivo,
 * título e "sair". Sem ele, só o que o flarum/messages faz sozinho.
 */
export function boxesOn(): boolean {
  return !!app.forum?.attribute('canelaMessagesBoxes');
}

/** As caixas que dá para mostrar agora (sem o backend, só as do flarum/messages). */
export function availableBoxes(): Box[] {
  if (!boxesOn()) return ['inbox', 'unread'];

  return messageGroup()?.member ? [...BOXES, 'group'] : BOXES;
}

/**
 * A caixa da equipe (backend do tema, migration de grupos): o grupo, se quem
 * vê é da equipe, e alguém dela para receber a mensagem "à equipe".
 */
export function messageGroup(): { id: number; member: boolean; contactUserId: number | null } | null {
  const value = app.forum?.attribute<any>('canelaMessageGroup');

  return value && typeof value === 'object' && value.id ? value : null;
}

/** O grupo (modelo) da caixa da equipe, do store (o fórum já traz os grupos). */
export function messageGroupModel(): Group | null {
  const group = messageGroup();

  return group ? app.store.getById<Group>('groups', String(group.id)) || null : null;
}

/** O nome do grupo no chip ("moderators" no Discourse; aqui o plural do grupo). */
export function groupLabel(group: Group): string {
  return group.namePlural() || group.nameSingular();
}

/** A rota da aba "Mensagens" do perfil, existindo. */
export function hasProfileRoute(): boolean {
  return !!(app.routes as any)['user.messages'];
}

/**
 * O endereço de uma caixa. `/u/:username/messages/:box` só abre direto com o
 * backend do tema (a rota do PHP é dele); sem ele a caixa vai na query.
 */
export function boxHref(user: User, box: Box = 'inbox'): string {
  if (!hasProfileRoute()) return app.route('messages');

  const username = user.slug();

  if (box === 'inbox') return app.route('user.messages', { username });

  return boxesOn() ? app.route('user.messages.box', { username, box }) : app.route('user.messages', { username, box });
}

/** "Minhas mensagens": a caixa de entrada de quem está logado. */
export function myMessagesHref(): string {
  const user = app.session.user;

  return user ? boxHref(user) : app.route('messages');
}

/** O endereço de uma conversa (o "tópico" da mensagem). */
export function dialogHref(dialog: Dialog, near?: number): string {
  const helper = (app.route as any).dialog;

  return helper ? helper(dialog, near) : app.route('messages');
}

/** O título do tópico de mensagem: o do composer ou o "Conversando com X". */
export function dialogTitle(dialog: Dialog): string {
  return dialog.attribute<string | null>('canelaTitle') || dialog.title() || t('messages.untitled');
}

export function isArchived(dialog: Dialog): boolean {
  return !!dialog.attribute<boolean>('canelaArchived');
}

/** Os participantes, sem os que sumiram do store (conta excluída). */
export function participants(dialog: Dialog): User[] {
  const users = dialog.users();

  return (users ? users : []).filter((user): user is User => !!user);
}

/**
 * A conversa com o usuário do sistema (as mensagens automáticas): só de ida,
 * ninguém lê a caixa dele, então ela não tem resposta.
 */
export function isSystemDialog(dialog: Dialog): boolean {
  return participants(dialog).some((user) => !!user.attribute('canelaIsSystem'));
}

/**
 * "Novo (n)" e "Não lidos (n)". Com o backend do tema vêm separados e sem o
 * arquivo; sem ele, o flarum/messages só sabe o total de conversas com não
 * lidas, que fica todo em "Não lidos".
 */
export function boxCounts(): { new: number; unread: number; group: number } {
  const user = app.session.user;

  if (!user) return { new: 0, unread: 0, group: 0 };

  const counts = user.attribute<{ new?: number; unread?: number; group?: number } | undefined>('canelaDialogCounts');

  if (counts && typeof counts === 'object')
    return { new: Number(counts.new) || 0, unread: Number(counts.unread) || 0, group: Number(counts.group) || 0 };

  return { new: 0, unread: Number(user.attribute<number>('unreadDialogCount')) || 0, group: 0 };
}

/** O total que "Minhas mensagens" e a "Caixa de entrada" mostram. */
export function totalUnread(): number {
  const counts = boxCounts();

  // A equipe vê também o que chegou na caixa do grupo.
  return counts.new + counts.unread + counts.group;
}

/** As visualizações da conversa; `null` sem a contagem no banco. */
export function dialogViews(dialog: Dialog): number | null {
  const value = dialog.attribute<number | null | undefined>('viewCount');

  return typeof value === 'number' ? value : null;
}

/**
 * Os grupos da equipe (administradores e moderadores) dos outros
 * participantes: o chip "👥 moderators" sob o título, como os
 * `participant_groups` de uma mensagem do Discourse. No flarum/messages a
 * conversa é entre pessoas, então o chip diz de que equipe é quem está nela.
 */
export function staffGroups(dialog: Dialog): Group[] {
  const groupId = dialog.attribute<number | null>('canelaGroupId');

  // Mensagem da caixa de um grupo: o chip é o do grupo.
  if (groupId) {
    const group = app.store.getById<Group>('groups', String(groupId));

    return group ? [group] : [];
  }

  const me = app.session.user;
  const seen = new Set<string>();
  const groups: Group[] = [];

  participants(dialog)
    .filter((user) => user !== me)
    .forEach((user) => {
      ((user.groups() || []) as (Group | undefined)[]).forEach((group) => {
        const id = group?.id();

        if (!group || !id || seen.has(id)) return;
        if (id !== '1' && id !== '4') return;

        seen.add(id);
        groups.push(group);
      });
    });

  return groups;
}

/** O número de mensagens da conversa: o `number` da última, que é sequencial. */
export function messageCount(dialog: Dialog): number {
  const last = dialog.lastMessage();

  return last ? last.number() || 0 : 0;
}

/**
 * Importa um componente carregado sob demanda já no formato `{ default }` que
 * o `composer.load` espera. O `asyncModuleImport` devolve a própria classe
 * quando o módulo já está registrado — e uma classe que herda do ComposerBody
 * herda também o `default` estático que o core pendura nele, apontando para o
 * ComposerBody: o composer abria vazio, com o corpo errado.
 */
export function lazyComponent(path: string): Promise<{ default: any }> {
  return flarum.reg.asyncModuleImport(path).then((mod: any) => ({
    default: typeof mod === 'function' ? mod : Object.prototype.hasOwnProperty.call(mod, 'default') ? mod.default : mod,
  }));
}

/**
 * Abre o composer de mensagem do flarum/messages (o MessageComposer vem num
 * pedaço carregado sob demanda, como o ComposerBody do core).
 */
export function openMessageComposer(attrs: Record<string, unknown> = {}): Promise<unknown> {
  return flarum.reg.asyncModuleImport('flarum/forum/components/ComposerBody').then(() =>
    app.composer
      .load(() => lazyComponent('ext:flarum/messages/forum/components/MessageComposer'), {
        user: app.session.user,
        ...attrs,
      })
      .then(() => app.composer.show())
  );
}

/** Quem pode começar uma mensagem (a permissão do flarum/messages). */
export function canSendMessages(): boolean {
  return !!app.session.user?.attribute<boolean>('canSendAnyMessage');
}

/**
 * "Mensagem a um membro da equipe": abre a mensagem nova já endereçada ao
 * grupo da equipe (o chip do grupo no destinatário). Sem a caixa da equipe,
 * leva para a lista da equipe no Sobre.
 */
export function messageStaff(event?: Event): void {
  const group = messageGroup();

  if (!group || !canSendMessages()) {
    const routes: any = app.routes;

    if (!event) m.route.set(routes['canela.about'] ? app.route('canela.about') : routes.about ? app.route('about') : app.route('index'));
    return;
  }

  event?.preventDefault();

  openMessageComposer()
    .then(() => {
      const fields: any = app.composer.fields;

      if (fields?.canelaGroup) fields.canelaGroup(group.id);
      m.redraw();
    })
    .catch(() => {});
}
