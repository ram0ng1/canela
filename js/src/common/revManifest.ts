/*
 * No Windows, o core grava a revisão dos chunks com a chave montada com o
 * separador do sistema (`js\ramon-canela\forum\features/messages/ui.js`), mas
 * o carregador procura por `js/ramon-canela/forum/features/messages/ui.js`.
 * Sem achar a revisão, o chunk sai sem `?v=` e o navegador pode usar uma cópia
 * velha do cache depois de um build — um link que "não vai a lugar algum".
 *
 * Roda na avaliação do módulo, antes de qualquer chunk ser pedido: o registro
 * do core só lê o manifesto (e guarda) no primeiro carregamento sob demanda.
 * Em servidores Linux as chaves já vêm com "/" e nada muda.
 */
export default function normalizeRevManifest(): void {
  const node = typeof document !== 'undefined' ? document.getElementById('flarum-rev-manifest') : null;

  if (!node?.textContent || node.textContent.indexOf('\\\\') === -1) return;

  try {
    const revisions = JSON.parse(node.textContent) as Record<string, string>;
    const normalized: Record<string, string> = {};

    for (const key of Object.keys(revisions)) {
      normalized[key] = revisions[key];
      normalized[key.replace(/\\/g, '/')] = revisions[key];
    }

    node.textContent = JSON.stringify(normalized);

    // O registro pode já ter lido o manifesto (um chunk do core no boot):
    // completa o mapa que ele guardou.
    const reg = (window as any).flarum?.reg;

    if (reg && reg._revisions) Object.assign(reg._revisions, normalized);
  } catch {
    // Manifesto ilegível: o core segue como estava.
  }
}
