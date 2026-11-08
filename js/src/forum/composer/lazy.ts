/*
 * O que só aparece dentro do editor ou do modal de tags desce num chunk
 * próprio, junto com o chunk do core (ou do flarum/tags) que desenha essas
 * telas: o `beforeChunk` faz o nosso chegar primeiro, então os ganchos já
 * estão no lugar quando o editor ou o modal monta.
 */
import { beforeChunk, once } from '../utils/chunkGate';

const loadComposer = once(() => import('./composerChunk').then((mod) => mod.default()));
const loadTagModal = once(() => import('./tagModal').then((mod) => mod.default()));

export default function installComposerChunks(): void {
  beforeChunk(
    (namespace, url) => namespace === 'core' && /\/forum\/components\/(Composer|DiscussionComposer|ReplyComposer|EditPostComposer)\.js/.test(url),
    loadComposer
  );
  beforeChunk((_namespace, url) => /\/components\/(TagSelectionModal|TagDiscussionModal)\.js/.test(url), loadTagModal);
}
