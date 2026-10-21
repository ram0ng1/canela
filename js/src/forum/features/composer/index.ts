/*
 * Editor (composer) do tema: seletor de emoji, tópicos
 * semelhantes, #categoria/#etiqueta, rascunhos (com o fof/drafts), responder como
 * tópico vinculado e a pré-visualização lado a lado. Cada um pode ser
 * desligado no card "Editor" do admin (`canela.composer_*`).
 */
import installEmoji from './emoji/installEmoji';
import installSimilarTopics from './installSimilarTopics';
import installHashtags from './installHashtags';
import installDrafts from './drafts/installDrafts';
import installLinkedTopic from './installLinkedTopic';
import installPreview from './installPreview';

export default function installComposer() {
  installEmoji();
  installSimilarTopics();
  installHashtags();
  installDrafts();
  installLinkedTopic();
  installPreview();
}
