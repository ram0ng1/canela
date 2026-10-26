/**
 * Se o composer está no meio de uma troca. O `updateHeight()` do core mede a
 * caixa a cada redesenho e grava a altura na área de texto: no meio do
 * movimento, ela sai da caixa antiga, e o rodapé ia para o meio da tela
 * (entrando na tela cheia) ou para fora da janela (saindo) até o fim.
 */
export declare function isMorphing(): boolean;
/** Aplica `change` (que redesenha) e anima o composer da caixa antiga até a nova. */
export declare function morphComposer(change: () => void): void;
