import type { EmojiRow } from '../emoji-data';
/** Com o flarum/emoji ligado, os emoji são as imagens do twemoji; sem ele, o caractere do sistema. */
export declare function usesTwemoji(): boolean;
/** O nome do arquivo no twemoji: os code points em hexa, sem o FE0F (a não ser em sequências com ZWJ). */
export declare function twemojiCode(emoji: string): string;
export declare function twemojiUrl(emoji: string): string;
export declare const TONES: string[];
export declare function getTone(): number;
export declare function setTone(tone: number): void;
/** O emoji no tom escolhido, quando ele aceita tom (o 4º campo da linha é o modelo). */
export declare function withTone(row: EmojiRow, tone: number): string;
export declare function getRecent(): string[];
/** Guarda o emoji base (sem tom): o tom é aplicado na hora de mostrar. */
export declare function pushRecent(base: string): void;
/** Busca sem acento e sem caixa, como o usuário digita. */
export declare function normalize(text: string): string;
/**
 * Se a linha casa com a busca: cada palavra digitada precisa ser o começo de
 * um atalho ou de uma das palavras de busca.
 */
export declare function matches(row: EmojiRow, terms: string[]): boolean;
/** A lista só é baixada quando o seletor (ou o autocompletar) é usado pela primeira vez. */
export declare function loadEmojiData(): Promise<import("../emoji-data").EmojiGroup[]>;
