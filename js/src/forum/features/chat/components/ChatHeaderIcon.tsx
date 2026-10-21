/*
 * O ícone do chat no cabeçalho, com o
 * indicador da preferência "Mostrar indicador de atividade no cabeçalho":
 *
 * - Todas as novas mensagens: o número verde (menções e MDs) ou, sem ele, o
 *   ponto azul de "há não lidas";
 * - Mensagens diretas e menções: só o número verde;
 * - Apenas menções: o número de menções;
 * - Nunca: nada.
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat from '../ChatStore';
import { UnreadIndicator } from './bits';
import { ct, preference } from '../utils';

export default class ChatHeaderIcon extends Component {
  view(): Mithril.Children {
    const totals = chat.totals();
    const mode = preference<string>('canelaChatHeaderIndicator', 'all_new');
    const active = chat.isFullPage() || (chat.drawer.open && app.screen() !== 'phone');

    let indicator: Mithril.Children = null;

    if (mode === 'only_mentions') indicator = UnreadIndicator(totals.mentions, false);
    else if (mode === 'dm_and_mentions') indicator = UnreadIndicator(totals.urgent, false);
    else if (mode === 'all_new') indicator = UnreadIndicator(totals.urgent, totals.unread);

    const title = chat.isFullPage() ? ct('title_capitalized') : chat.drawer.open ? ct('close') : ct('open');

    return (
      <a
        className={classList('Button Button--flat Button--icon icon chat-header-icon__button', { active })}
        href={app.route('canela.chat')}
        title={title}
        aria-label={title}
        onclick={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.button !== 0) return;

          e.preventDefault();
          chat.toggleFromHeader();
        }}
      >
        <Icon name="far fa-message" />
        {indicator}
      </a>
    );
  }
}
