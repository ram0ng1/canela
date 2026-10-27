import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import type { ChatChannel } from './types';
import { caps, chatOn, ct } from './flags';
export { caps, chatOn, ct };
export declare function chatUser(id: number | null | undefined): User | null;
export declare function displayName(id: number | null | undefined): string;
export declare function meId(): number;
/** Os outros participantes de uma MD (sem o próprio leitor). */
export declare function otherParticipants(channel: ChatChannel): number[];
export declare function isSelfDm(channel: ChatChannel): boolean;
/** O título do canal: o nome do canal público ou do grupo, ou os nomes da MD. */
export declare function channelTitle(channel: ChatChannel): string;
export declare function channelPath(channel: ChatChannel, rest?: string): string;
/** O placeholder do composer. */
export declare function composerPlaceholder(channel: ChatChannel, inThread: boolean): string;
export declare function sameDay(a: Date, b: Date): boolean;
/** O texto do separador de dia: "Hoje", "Ontem", "13 de outubro" (ou com o ano). */
export declare function separatorDate(date: Date, now?: Date): string;
/** A hora da mensagem ("14:35"); de outro dia, com a data curta antes. */
export declare function messageTime(date: Date, now?: Date): string;
export declare function tinyTime(date: Date): string;
export declare function longDate(date: Date): string;
/** O emoji como o resto do fórum o desenha: a imagem do twemoji, ou o caractere. */
export declare function emoji(char: string, className?: string): Mithril.Children;
/**
 * Os sons "Sino" e "Ding", sintetizados — sem arquivos de áudio
 * para baixar. Só tocam com a aba em primeiro plano.
 */
export declare function playSound(kind: string): void;
export declare function preference<T>(key: string, fallback: T): T;
export declare function readLocal<T>(key: string, fallback: T): T;
export declare function writeLocal(key: string, value: unknown): void;
/** As três reações de um clique: as mais usadas pelo leitor, ou ❤️ 👍 😄. */
export declare function quickReactions(): string[];
export declare function countReaction(char: string): void;
export declare function copyText(text: string): Promise<void>;
