/*
 * (11) Canal favorito (a estrela do Discourse): a preferência
 * `canelaRamonChatStarred` (lista de ids) do leitor. Os favoritos vão para o
 * topo das listas da barra lateral (pelo gancho `sortChannels`) e ganham a
 * estrela na linha (`channelSuffix`); o botão fica no cabeçalho do canal e
 * nas Informações do canal (channelView.tsx, channelInfo.tsx).
 *
 * `starredIds()` é exportado para quem mais quiser ordenar ou destacar.
 */
import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';

import { feature, pref } from './flags';

export function starredIds(): number[] {
  if (!feature('starred')) return [];

  const value = pref<unknown>('canelaRamonChatStarred', []);

  return Array.isArray(value) ? value.map(Number).filter((id) => id > 0) : [];
}

export function isStarred(channelId: number | string): boolean {
  return starredIds().includes(Number(channelId));
}

export function toggleStar(channelId: number | string): Promise<unknown> {
  const user = app.session.user;

  if (!user) return Promise.resolve();

  const id = Number(channelId);
  const current = starredIds();
  const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current];

  // Na hora (savePreferences atualiza o modelo antes da resposta).
  const saving = user.savePreferences({ canelaRamonChatStarred: next });

  m.redraw();

  return saving;
}

/** Os favoritos primeiro, mantendo a ordem do ramon/chat dentro de cada grupo. */
export function sortStarred<T extends { id(): string | undefined }>(channels: T[]): T[] {
  const starred = starredIds();

  if (!starred.length) return channels;

  return [...channels.filter((c) => starred.includes(Number(c.id()))), ...channels.filter((c) => !starred.includes(Number(c.id())))];
}

export function starSuffix(channel: { id(): string | undefined }): Mithril.Children {
  return isStarred(channel.id() || 0) ? <Icon name="fas fa-star" className="CanelaRamonChat-starred" /> : null;
}
