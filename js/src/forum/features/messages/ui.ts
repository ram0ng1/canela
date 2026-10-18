/*
 * A integração com as telas do flarum/messages (página da conversa, fluxo,
 * mensagem, composer de mensagem, reações): um chunk sob demanda. O index.tsx
 * o pede antes de qualquer chunk do flarum/messages descer, então as extensões
 * já estão na fila do `flarum.reg.onLoad` quando os componentes chegam.
 */
import installTopic from './topic';
import installComposer from './composer';
import installMessageReactions from './reactions';

let installed = false;

export default function installMessagesUi(): void {
  if (installed) return;
  installed = true;

  installTopic();
  installComposer();
  installMessageReactions();
}
