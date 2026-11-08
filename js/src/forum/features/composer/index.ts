/*
 * Editor (composer) do tema: seletor de emoji, tópicos
 * semelhantes, #categoria/#etiqueta, rascunhos (com o fof/drafts), responder como
 * tópico vinculado e a pré-visualização lado a lado. Cada um pode ser
 * desligado no card "Editor" do admin (`canela.composer_*`).
 */
import installHashtags from './installHashtags';
import installDrafts from './drafts/installDrafts';
import installLinkedTopic from './installLinkedTopic';
import installPreview from './installPreview';
import installComposerChunks from '../../composer/lazy';

export default function installComposer() {
  installHashtags();
  installDrafts();
  installLinkedTopic();
  installPreview();
  // Emoji, tópicos semelhantes, o menu do `@` e o modal de tags: sob demanda.
  installComposerChunks();
}
