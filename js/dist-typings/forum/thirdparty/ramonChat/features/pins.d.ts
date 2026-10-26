/** Os modelos do ramon/chat (`chat-messages`), sem importar a classe dele. */
type Message = any;
export declare function pinBarOn(): boolean;
/**
 * As fixadas do canal, na ordem da conversa: a lista buscada, as da janela
 * carregada (fixar uma mensagem à vista entra na hora) e a prévia do ramon/chat
 * (a mais nova, que chega antes da lista). Os modelos são os do store, então
 * desafixar em qualquer lugar tira a fixada daqui também.
 */
export declare function pinsFor(channelId: number): Message[];
/** Busca as fixadas do canal (uma por vez; a resposta antiga não sobrescreve a nova). */
export declare function refreshPins(channelId: number): Promise<void>;
/** A faixa está oculta neste navegador; uma fixada mais nova que a ocultação a traz de volta. */
export declare function barDismissed(channelId: number, pins?: Message[]): boolean;
export default function installPins(): void;
export {};
