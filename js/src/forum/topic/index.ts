/*
 * A página do tópico no jeito do Discourse: título com os badges dentro do
 * cartão, posts com a barra de ações embaixo, a linha do tempo na coluna da
 * direita, o mapa do tópico depois do primeiro post, e no fim os botões do
 * tópico e os tópicos sugeridos.
 */
import app from 'flarum/forum/app';

import installHero from './hero';
import installLayout from './layout';
import installPosts from './posts';
import installTimeline from './timeline';
import installTopicMap from './topicMap';
import installUserCard from './userCard';
import installAuthorFilter from './authorFilter';
import installEventPosts from './eventPosts';
import installReplyToComposer from './replyToComposer';
import installMarkUnread from './markUnread';

export default function installTopic(): void {
  // O composer no "em resposta a" do avocado (extends por nome de módulo:
  // os corpos do composer vêm em chunks).
  installReplyToComposer();
  installMarkUnread();

  // Tudo é registrado no beforeMount, que roda depois de todos os
  // initializers: o extend registrado por último roda por último, e é assim
  // que o tema enxerga (e repagina) os itens que tags, likes e mentions põem
  // nas mesmas listas, qualquer que seja a ordem de boot das extensões.
  app.beforeMount(() => {
    installHero();
    installLayout();
    installPosts();
    installEventPosts();
    installTimeline();
    installTopicMap();
    installUserCard();
    installAuthorFilter();
  });
}
