// O que o tema acrescenta ao payload do HTML (`app.data`).
declare module 'flarum/common/Application' {
  export interface ApplicationData {
    /** Respostas pré-carregadas (src/Preload), por chave do pedido. */
    canelaPreload?: Record<string, unknown>;
    /** A página de redefinição de senha (extend/auth.php). */
    canelaReset?: unknown;
    /** Os carregadores prontos do admin (estilo → SVG). */
    canelaLoaderPresets?: Record<string, string>;
    /** ernestdefoe/wardrobe: os esquemas de cor. */
    wardrobe?: unknown;
  }
}

export {};
