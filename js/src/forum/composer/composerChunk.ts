/*
 * Os ganchos que só valem com o editor aberto (ver ./lazy.ts): o menu do
 * `@`/`#` do flarum/mentions, o emoji (botão e `:atalho:`) e os tópicos
 * semelhantes do composer de tópico novo.
 */
import installMentionsDropdown from './mentionsDropdown';
import installEmoji from '../features/composer/emoji/installEmoji';
import installSimilarTopics from '../features/composer/installSimilarTopics';

export default function installComposerChunk(): void {
  installEmoji();
  installSimilarTopics();
  installMentionsDropdown();
}
