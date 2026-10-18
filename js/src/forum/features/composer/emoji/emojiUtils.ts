/*
 * Utilidades do seletor de emoji: a imagem do twemoji (a mesma que o
 * flarum/emoji desenha nos posts), o tom de pele e os usados recentemente.
 */
import app from 'flarum/forum/app';

import type { EmojiRow } from '../emoji-data';
import { isExtensionEnabled } from '../../../utils/settings';

/**
 * A versão maior do twemoji que o flarum/emoji 2.0 usa (`@twemoji/api` 17).
 * O endereço configurado no admin dele traz "[version]" no lugar do número.
 */
const TWEMOJI_MAJOR = '17';

const ZWJ = '‍';

/** Com o flarum/emoji ligado, os emoji são as imagens do twemoji; sem ele, o caractere do sistema. */
export function usesTwemoji(): boolean {
  return isExtensionEnabled('flarum-emoji') && !!app.forum.attribute<string>('flarum-emoji.cdn');
}

/** O nome do arquivo no twemoji: os code points em hexa, sem o FE0F (a não ser em sequências com ZWJ). */
export function twemojiCode(emoji: string): string {
  const text = emoji.includes(ZWJ) ? emoji : emoji.replace(/️/g, '');

  return Array.from(text)
    .map((char) => char.codePointAt(0)!.toString(16))
    .join('-');
}

export function twemojiUrl(emoji: string): string {
  const cdn = (app.forum.attribute<string>('flarum-emoji.cdn') || '').replace('[version]', TWEMOJI_MAJOR);

  return `${cdn}72x72/${twemojiCode(emoji)}.png`;
}

// ─── Tom de pele ────────────────────────────────────────────────────────────

export const TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];

const TONE_KEY = 'canela.emoji.tone';
const RECENT_KEY = 'canela.emoji.recent';
const RECENT_MAX = 30;

// O localStorage pode estar bloqueado (aba anônima, política do navegador):
// sem ele, o tom volta ao padrão e a lista de recentes só dura a página.
let memoryTone = 0;
let memoryRecent: string[] = [];

export function getTone(): number {
  try {
    const value = Number(localStorage.getItem(TONE_KEY));

    return Number.isInteger(value) && value >= 0 && value < TONES.length ? value : 0;
  } catch {
    return memoryTone;
  }
}

export function setTone(tone: number): void {
  memoryTone = tone;

  try {
    localStorage.setItem(TONE_KEY, String(tone));
  } catch {
    // Fica só na memória.
  }
}

/** O emoji no tom escolhido, quando ele aceita tom (o 4º campo da linha é o modelo). */
export function withTone(row: EmojiRow, tone: number): string {
  const template = row[3];

  return template && tone > 0 ? template.split('~').join(TONES[tone]) : row[0];
}

// ─── Usados recentemente ────────────────────────────────────────────────────

export function getRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');

    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return memoryRecent;
  }
}

/** Guarda o emoji base (sem tom): o tom é aplicado na hora de mostrar. */
export function pushRecent(base: string): void {
  const list = [base, ...getRecent().filter((item) => item !== base)].slice(0, RECENT_MAX);

  memoryRecent = list;

  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Fica só na memória.
  }
}

/** Busca sem acento e sem caixa, como o usuário digita. */
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Se a linha casa com a busca: cada palavra digitada precisa ser o começo de
 * um atalho ou de uma das palavras de busca.
 */
export function matches(row: EmojiRow, terms: string[]): boolean {
  const haystack = ` ${row[1].replace(/_/g, ' ')} ${row[2]}`;

  return terms.every((term) => haystack.includes(` ${term}`));
}

let dataPromise: Promise<typeof import('../emoji-data').default> | null = null;

/** A lista só é baixada quando o seletor (ou o autocompletar) é usado pela primeira vez. */
export function loadEmojiData() {
  dataPromise ||= import('../emoji-data').then((module) => module.default);

  return dataPromise;
}
