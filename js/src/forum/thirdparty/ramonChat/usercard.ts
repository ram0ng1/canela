/*
 * No chat, o avatar e o nome do autor, as menções @fulano e as linhas de
 * membros abrem o cartão de usuário do tema (topic/components/UserCardPopover),
 * o mesmo dos posts, ancorado no que foi clicado — como no chat do Discourse.
 * Ctrl/Cmd+clique e o botão do meio continuam abrindo o perfil numa aba nova.
 *
 * Um ouvinte só, na captura: o nome é um Link do Mithril, que navegaria antes,
 * e as mensagens da gaveta e do painel do fio são as mesmas classes.
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

import { openUserCard } from '../../topic/components/UserCardPopover';
import { topicSettings } from '../../topic/ui';
import { findUser, slugFrom } from '../../gaps/cooked/mentions';
import { thirdParty } from '../settings';

/** O avatar e o nome do autor de uma mensagem (página, gaveta, fio, fixadas). */
const AUTHOR = '.ChatMessage-gutter .Avatar, .ChatMessage-avatar, .ChatMessage-author a, .ChatMessage-author .ChatUserLink';
/** Menções no texto, e o nome e o avatar nas listas de membros. */
const LINKED = '.ChatMessage-content a.UserMention, .ChatChannelInfo-member a[href], .ChatAddMembers-result a[href]';
const MEMBER_AVATAR = '.ChatChannelInfo-member > .Avatar';

function authorOf(trigger: HTMLElement): User | null {
  const row = trigger.closest<HTMLElement>('.ChatMessage[data-id]');
  const id = row?.getAttribute('data-id');
  const message: any = id ? app.store.getById('chat-messages' as any, id) : null;
  const user = message?.isBot?.() ? null : message?.user?.();

  return user || null;
}

function onClick(event: MouseEvent): void {
  if (!thirdParty.ramonChat() || !topicSettings.userCard()) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const target = event.target as HTMLElement | null;

  if (!target?.closest) return;

  const author = target.closest<HTMLElement>(AUTHOR);

  if (author) {
    const user = authorOf(author);

    if (!user) return;

    event.preventDefault();
    event.stopPropagation();

    // Ancorado no avatar quando ele está à vista (o cartão se alinha a ele).
    const avatar = author.closest('.ChatMessage')?.querySelector<HTMLElement>('.ChatMessage-gutter .Avatar');
    openUserCard(user, avatar && avatar.offsetParent !== null ? avatar : author);
    return;
  }

  const memberAvatar = target.closest<HTMLElement>(MEMBER_AVATAR);
  const link = memberAvatar
    ? memberAvatar.parentElement?.querySelector<HTMLAnchorElement>('a[href]') || null
    : target.closest<HTMLAnchorElement>(LINKED);

  if (!link) return;

  const slug = slugFrom(link);

  if (!slug) return;

  event.preventDefault();
  event.stopPropagation();

  findUser(slug).then((user) => {
    // Sem o usuário (apagado, sem permissão), o link volta a ser só um link.
    if (user) openUserCard(user, memberAvatar || link);
    else window.location.href = link.href;
  });
}

export default function installRamonChatUserCard(): void {
  document.addEventListener('click', onClick, true);
}
