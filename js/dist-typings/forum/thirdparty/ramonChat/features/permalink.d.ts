/** O endereço absoluto de uma mensagem. */
export declare function messageUrl(message: any): string;
/** O caminho (relativo) de uma mensagem a partir dos números, para os avisos do sino. */
export declare function messagePath(channelId: number, messageId: number, threadId?: number | null): string;
export default function installPermalink(): void;
