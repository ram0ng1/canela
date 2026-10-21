/*
 * A segunda linha da aba "Mensagens" do perfil: o seletor de caixa ("Caixa de entrada ▾",
 * com a bolinha de não lidas), as abas da caixa (Últimos, Enviadas, Novo,
 * Não lidos, Arquivo) e, à direita, "✉ Nova mensagem".
 *
 * O flarum/messages não tem caixa de grupo (toda conversa é entre duas
 * pessoas), então o seletor tem só a caixa pessoal.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import LinkButton from 'flarum/common/components/LinkButton';
import classList from 'flarum/common/utils/classList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import {
  availableBoxes,
  boxCounts,
  boxHref,
  canSendMessages,
  groupLabel,
  messageGroupModel,
  openMessageComposer,
  totalUnread,
  type Box,
} from './util';

export interface MessagesNavAttrs extends ComponentAttrs {
  user: User;
  box: Box;
  /** Depois de enviar uma mensagem nova, para a lista se atualizar. */
  onsent?: () => void;
}

/** Os ícones das caixas (`envelope`, `reply`, `circle-exclamation`, `circle-plus`, `box-archive`). */
const ICONS: Record<Box, string> = {
  inbox: 'far fa-envelope',
  sent: 'fas fa-reply',
  new: 'fas fa-circle-exclamation',
  unread: 'fas fa-circle-plus',
  archive: 'fas fa-box-archive',
  group: 'far fa-envelope',
};

export default class MessagesNav extends Component<MessagesNavAttrs> {
  view(): Mithril.Children {
    const { user, box } = this.attrs;
    const viewingSelf = app.session.user === user;

    return (
      <nav className="CanelaMessagesNav" aria-label={t('messages.nav.label')}>
        <div className="CanelaMessagesNav-inbox">{this.inboxDropdown(user)}</div>
        {/* As abas com o desenho das abas do perfil (`.CanelaUserNav`), sem o seletor dentro: os estilos de lista dela pegariam o menu dele. */}
        <div className="CanelaUserNav CanelaMessagesNav-pillsWrap">
          <ul className="CanelaMessagesNav-pills">
            {(box === 'group' ? (['group'] as Box[]) : availableBoxes().filter((item) => item !== 'group'))
              // Novo e Não lidos só no próprio perfil (`viewingSelf`).
              .filter((item) => viewingSelf || (item !== 'new' && item !== 'unread'))
              .map((item) => (
                <li className={classList({ active: item === box })}>
                  <LinkButton
                    href={boxHref(user, item)}
                    icon={ICONS[item]}
                    active={item === box}
                    className={`CanelaMessagesNav-pill CanelaMessagesNav-pill--${item}`}
                  >
                    {this.label(item)}
                  </LinkButton>
                </li>
              ))}
          </ul>
        </div>
        <div className="CanelaMessagesNav-controls">
          {viewingSelf && canSendMessages() ? (
            <Button
              className="Button Button--primary CanelaMessagesNav-new"
              icon="fas fa-envelope"
              onclick={() => openMessageComposer({ onsubmit: () => this.attrs.onsent?.() }).catch(() => {})}
            >
              {t('messages.nav.new_message')}
            </Button>
          ) : null}
        </div>
      </nav>
    );
  }

  label(box: Box): string {
    const counts = boxCounts();

    if (box === 'new' && counts.new) return t('messages.nav.new_with_count', { count: counts.new });
    if (box === 'unread' && counts.unread) return t('messages.nav.unread_with_count', { count: counts.unread });
    // Na caixa do grupo a aba é a "Últimos" dela.
    if (box === 'group') return t('messages.nav.inbox');

    return t(`messages.nav.${box}`);
  }

  /**
   * "Caixa de entrada ▾" (`messages-dropdown`, um botão padrão): a bolinha
   * aparece quando há novas ou não lidas, como o `d-icon-d-unread` de quem
   * não pediu as contagens na barra lateral.
   */
  inboxDropdown(user: User): Mithril.Children {
    const onGroup = this.attrs.box === 'group';
    const unread = totalUnread() > 0;
    const groupCount = boxCounts().group;
    const group = availableBoxes().includes('group') ? messageGroupModel() : null;
    const label = t('messages.nav.inbox_box');
    const current = onGroup && group ? groupLabel(group) : label;

    return (
      <Dropdown
        className="CanelaMessagesNav-dropdown"
        buttonClassName="Button CanelaMessagesNav-trigger"
        menuClassName="CanelaMessagesNav-menu"
        caretIcon="fas fa-angle-down"
        label={[
          onGroup ? <Icon name="fas fa-inbox" className="CanelaMessagesNav-triggerIcon" /> : null,
          <span className="CanelaMessagesNav-triggerLabel">{current}</span>,
          (onGroup ? groupCount : unread) ? <Icon name="fas fa-circle" className="CanelaMessagesNav-unreadDot" /> : null,
        ]}
        accessibleToggleLabel={t('messages.nav.all')}
        title={t('messages.nav.all')}
      >
        <Button
          className={classList('Button CanelaMessagesNav-option', { 'is-selected': !onGroup })}
          active={!onGroup}
          onclick={() => m.route.set(boxHref(user))}
        >
          {label}
          {unread ? <Icon name="fas fa-circle" className="CanelaMessagesNav-unreadDot" /> : null}
        </Button>
        {/* A caixa do grupo (`inbox` + nome do grupo), só para a equipe. */}
        {group ? (
          <Button
            className={classList('Button CanelaMessagesNav-option', { 'is-selected': onGroup })}
            icon="fas fa-inbox"
            active={onGroup}
            onclick={() => m.route.set(boxHref(user, 'group'))}
          >
            {groupLabel(group)}
            {groupCount ? <Icon name="fas fa-circle" className="CanelaMessagesNav-unreadDot" /> : null}
          </Button>
        ) : null}
      </Dropdown>
    );
  }
}
