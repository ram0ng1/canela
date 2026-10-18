/*
 * "Mostrar indicador de atividade no cabeçalho" (preferência do Discourse)
 * aplicado ao botão do cabeçalho do ramon/chat. Só a lógica: o botão decide
 * o número pelos dois métodos abaixo (`count = menções || não lidas`, e a
 * classe `new` quando há menções), e o visual dele é do tema (RamonChat.less).
 *
 * - Todas as novas mensagens: o que o ramon/chat já faz;
 * - MDs e menções: as não lidas das MDs contam como "urgentes", o resto some;
 * - Apenas menções: só as menções;
 * - Nunca: nada.
 */
import { override } from 'flarum/common/extend';

import { chatState, component, feature, pref } from './flags';

type Mode = 'all_new' | 'dm_and_mentions' | 'only_mentions' | 'never';

function mode(): Mode {
  if (!feature('header_indicator')) return 'all_new';

  return pref<Mode>('canelaRamonChatHeaderIndicator', 'all_new');
}

/** As não lidas das MDs não silenciadas. */
function directUnread(): number {
  const state = chatState();

  if (!state) return 0;

  return (state.directChannels() as any[]).filter((c) => !c.isMuted()).reduce((sum, c) => sum + (Number(c.unreadCount()) || 0), 0);
}

export default function installHeaderIndicator(): void {
  override(component('ChatNavButton'), 'unreadMentions', function (this: any, original: () => number) {
    const value = mode();

    if (value === 'never') return 0;
    if (value === 'dm_and_mentions') return original() + directUnread();

    return original();
  });

  override(component('ChatNavButton'), 'unreadChannels', function (this: any, original: () => number) {
    const value = mode();

    if (value === 'all_new') return original();

    return 0;
  });
}
