/*
 * Peças comuns do chat: a tradução, as permissões do `canelaChat`, os
 * usuários no store, os títulos dos canais e as datas no formato curto
 * ("Hoje", "Ontem", "13 de outubro", "14:35"). O acesso à API mora em api.ts.
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { formatWith } from '../../utils/dates';
import { twemojiUrl, usesTwemoji } from '../composer/emoji/emojiUtils';
import type { ChatChannel } from './types';
import { caps, chatOn, ct } from './flags';

// Reexportados: o resto do chat importa tudo daqui.
export { caps, chatOn, ct };

export function chatUser(id: number | null | undefined): User | null {
  return id ? ((app.store.getById('users', String(id)) as User | undefined) ?? null) : null;
}

export function displayName(id: number | null | undefined): string {
  const user = chatUser(id);

  return user ? (user.displayName() as string) : ct('deleted_chat_username');
}

export function meId(): number {
  return Number(app.session.user?.id() || 0);
}

/** Os outros participantes de uma MD (sem o próprio leitor). */
export function otherParticipants(channel: ChatChannel): number[] {
  const others = channel.participantIds.filter((id) => id !== meId());

  return others.length ? others : channel.participantIds;
}

export function isSelfDm(channel: ChatChannel): boolean {
  return channel.type === 'direct' && channel.participantIds.length === 1;
}

/** O título do canal: o nome do canal público ou do grupo, ou os nomes da MD. */
export function channelTitle(channel: ChatChannel): string {
  if (channel.type === 'public') return channel.name || '';

  if (channel.name) return channel.name;

  return otherParticipants(channel)
    .map((id) => displayName(id))
    .join(', ');
}

export function channelPath(channel: ChatChannel, rest = ''): string {
  return app.route('canela.chat.channel', { slug: channel.slug || '-', id: channel.id }) + (rest ? `/${rest}` : '');
}

/** O placeholder do composer. */
export function composerPlaceholder(channel: ChatChannel, inThread: boolean): string {
  const reason = channel.cannotPostReason;

  if (reason === 'archived' || reason === 'closed' || reason === 'read_only') return ct(`placeholder_new_message_disallowed.${reason}`);
  if (reason === 'silenced') return ct('placeholder_silenced');
  if (inThread) return ct('placeholder_thread');
  if (channel.type === 'public') return ct('placeholder_channel', { channelName: `#${channel.name}` });
  if (isSelfDm(channel)) return ct('placeholder_self');
  if (channel.isGroup && channel.name) return ct('placeholder_group');

  const names = otherParticipants(channel).map((id) => `@${chatUser(id)?.username() ?? ''}`);

  return ct('placeholder_users', { commaSeparatedNames: names.join(', ') });
}

// ─── Datas ──────────────────────────────────────────────────────────────────

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** O texto do separador de dia: "Hoje", "Ontem", "13 de outubro" (ou com o ano). */
export function separatorDate(date: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

  if (diff === 0) return ct('chat_message_separator.today');
  if (diff === 1) return ct('chat_message_separator.yesterday');

  return formatWith(
    date,
    date.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }
  );
}

/** A hora da mensagem ("14:35"); de outro dia, com a data curta antes. */
export function messageTime(date: Date, now = new Date()): string {
  const time = formatWith(date, { hour: '2-digit', minute: '2-digit' });

  return sameDay(date, now) ? time : `${formatWith(date, { day: 'numeric', month: 'short' }).replace('.', '')} ${time}`;
}

export function tinyTime(date: Date): string {
  return formatWith(date, { hour: '2-digit', minute: '2-digit' });
}

export function longDate(date: Date): string {
  return formatWith(date, { dateStyle: 'full', timeStyle: 'short' } as Intl.DateTimeFormatOptions);
}

// ─── Emoji ──────────────────────────────────────────────────────────────────

/** O emoji como o resto do fórum o desenha: a imagem do twemoji, ou o caractere. */
export function emoji(char: string, className = 'emoji'): Mithril.Children {
  if (usesTwemoji()) return <img className={className} src={twemojiUrl(char)} alt={char} draggable={false} loading="lazy" />;

  return <span className={`${className} emoji--char`}>{char}</span>;
}

// ─── Som ────────────────────────────────────────────────────────────────────

let audio: AudioContext | null = null;

/**
 * Os sons "Sino" e "Ding", sintetizados — sem arquivos de áudio
 * para baixar. Só tocam com a aba em primeiro plano.
 */
export function playSound(kind: string): void {
  if (kind === 'none' || document.visibilityState !== 'visible') return;

  try {
    audio ||= new (window.AudioContext || (window as any).webkitAudioContext)();

    const notes = kind === 'bell' ? [880, 1320] : [1046.5];
    const now = audio.currentTime;

    notes.forEach((frequency, index) => {
      const oscillator = audio!.createOscillator();
      const gain = audio!.createGain();
      const start = now + index * 0.09;

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (kind === 'bell' ? 0.6 : 0.35));
      oscillator.connect(gain).connect(audio!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.7);
    });
  } catch {
    // Navegador sem Web Audio: fica em silêncio.
  }
}

export function preference<T>(key: string, fallback: T): T {
  const value = app.session.user?.preferences()?.[key];

  return value === undefined || value === null ? fallback : (value as T);
}

// ─── Armazenamento local ────────────────────────────────────────────────────

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`canela.chat.${key}`);

    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) localStorage.removeItem(`canela.chat.${key}`);
    else localStorage.setItem(`canela.chat.${key}`, JSON.stringify(value));
  } catch {
    // Sem armazenamento: vale só até recarregar.
  }
}

/** As três reações de um clique: as mais usadas pelo leitor, ou ❤️ 👍 😄. */
export function quickReactions(): string[] {
  const defaults = ['❤️', '👍', '😄'];

  if (preference<string>('canelaChatQuickReactions', 'frequent') === 'custom') {
    const custom = Array.from(String(preference('canelaChatQuickReactionsCustom', '')).matchAll(/\S+/g)).map((m) => m[0]);

    if (custom.length) return [...custom, ...defaults].slice(0, 3);
  }

  const counts = readLocal<Record<string, number>>('reactionCounts', {});
  const frequent = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([char]) => char);

  return [...new Set([...frequent, ...defaults])].slice(0, 3);
}

export function countReaction(char: string): void {
  const counts = readLocal<Record<string, number>>('reactionCounts', {});

  counts[char] = (counts[char] || 0) + 1;
  writeLocal('reactionCounts', counts);
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();

  return Promise.resolve();
}
