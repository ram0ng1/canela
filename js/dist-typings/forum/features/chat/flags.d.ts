import type { ChatCapabilities } from './types';
/** Tradução do chat (`ramon-canela.forum.chat.*`), já como texto. */
export declare function ct(key: string, params?: Record<string, unknown>): string;
export declare function caps(): ChatCapabilities;
/** O chat aparece para o leitor: ligado no admin, logado e com permissão. */
export declare function chatOn(): boolean;
