/** `caminho?a=1&b[c]=2`, sem codificação e em ordem alfabética. */
export declare function preloadKey(path: string, params?: Record<string, unknown>, extraPairs?: string[]): string;
/** A resposta pré-carregada desse pedido, uma vez só; null se não houver. */
export declare function takePreloaded<T = any>(path: string, params?: Record<string, unknown>, extraPairs?: string[]): T | null;
export default function installPreload(): void;
