/*
 * Clicar numa menção @fulano abre o cartão de usuário, como no Discourse —
 * o mesmo cartão do avatar do post. Ctrl/Cmd+clique continua abrindo o
 * perfil numa aba nova.
 *
 * O link da menção só traz o endereço do perfil (/u/slug): o usuário vem do
 * store quando já foi carregado, ou da API pelo slug.
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

import { openUserCard } from '../../topic/components/UserCardPopover';
import { gaps } from '../settings';

const MENTION = '.Post-body a.UserMention, .CanelaEmbeddedPost-body a.UserMention';

function slugFrom(link: HTMLAnchorElement): string | null {
  try {
    const path = new URL(link.href, window.location.href).pathname;
    const match = path.match(/\/u\/([^/]+)\/?$/);

    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function findUser(slug: string): Promise<User | null> {
  const lower = slug.toLowerCase();
  const cached = app.store
    .all<User>('users')
    .find((user) => String(user.slug()).toLowerCase() === lower || String(user.username()).toLowerCase() === lower);

  if (cached) return Promise.resolve(cached);

  return app.store
    .find<User>('users', slug, { bySlug: true } as any, { errorHandler: () => {} } as any)
    .then((user: any) => user || null)
    .catch(() => null);
}

function onClick(event: MouseEvent): void {
  if (!gaps.mentionCards()) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const link = (event.target as HTMLElement | null)?.closest?.(MENTION) as HTMLAnchorElement | null;

  if (!link) return;

  const slug = slugFrom(link);

  if (!slug) return;

  event.preventDefault();
  event.stopPropagation();

  findUser(slug).then((user) => {
    // Sem o usuário (apagado, sem permissão), o link volta a ser só um link.
    if (user) openUserCard(user, link);
    else window.location.href = link.href;
  });
}

export default function installMentionCards(): void {
  // Na captura: o Link do Mithril em volta do post navegaria antes.
  document.addEventListener('click', onClick, true);
}
