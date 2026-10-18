/*
 * As peças do tópico de mensagem do Discourse que o flarum/messages não tem:
 *
 * - o mapa da mensagem: "N visualizações" e a linha de participantes em
 *   pílulas (o grupo, as pessoas — a minha com ✕ para sair — e o "+" para
 *   convidar);
 * - o modal "Convidar";
 * - a linha do tempo da direita (datas, "n/n", responder e o sino);
 * - o controle de notificação da mensagem (Acompanhando, Monitorando, Normal,
 *   Silenciado(a)) com o motivo embaixo.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import DetailedDropdownItem from 'flarum/common/components/DetailedDropdownItem';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import Tooltip from 'flarum/common/components/Tooltip';
import Stream from 'flarum/common/utils/Stream';
import classList from 'flarum/common/utils/classList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import RecipientChooser from './RecipientChooser';
import { leaveDialog } from './actions';
import { shortDate } from '../../utils/dates';
import humanTime from 'flarum/common/helpers/humanTime';
import { t } from '../../utils/settings';
import { boxesOn, dialogViews, groupLabel, messageCount, messageGroup, participants, staffGroups, type Dialog } from './util';

// ---------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------

export function DialogMap(dialog: Dialog): Mithril.Children {
  const users = participants(dialog);
  const me = app.session.user;
  const views = dialogViews(dialog);
  const groups = staffGroups(dialog).filter(() => !!dialog.attribute('canelaGroupId'));

  return (
    <section className="CanelaTopicMap CanelaTopicMap--op CanelaDialogMap" aria-label={t('messages.topic.map_label')}>
      {views !== null ? (
        <div className="CanelaDialogMap-contents">
          <span className="CanelaDialogMap-views">{t('messages.topic.views', { count: views })}</span>
        </div>
      ) : null}
      <div className="CanelaDialogMap-pm">
        <div className="participants">
          {groups.map((group) => (
            <div className="user group" data-id={group.id()}>
              <span className="group-link">
                <Icon name="fas fa-user-group" />
                <span className="group-name">{groupLabel(group)}</span>
              </span>
            </div>
          ))}
          {users.map((user) => (
            <div className="user" data-id={user.id()}>
              <Link href={app.route.user(user)} className="user-link" title={user.username()}>
                <Avatar user={user} title={user.displayName()} />
                <span className="username">{user.username()}</span>
              </Link>
              {/* O ✕: no próprio nome é sair; nos outros, só para a equipe ou quem começou. */}
              {boxesOn() && me && (user === me || dialog.attribute('canelaCanRemove')) ? (
                <Tooltip text={user === me ? t('messages.topic.leave') : t('messages.topic.remove_user')}>
                  <Button
                    className="Button Button--icon remove-invited"
                    icon="fas fa-xmark"
                    aria-label={user === me ? t('messages.topic.leave') : t('messages.topic.remove_user')}
                    onclick={() => (user === me ? leaveDialog(dialog) : removeParticipant(dialog, user))}
                  />
                </Tooltip>
              ) : null}
            </div>
          ))}
          {boxesOn() && dialog.canSendMessage() !== false ? (
            <Tooltip text={t('messages.invite.title')}>
              <Button
                className="Button Button--icon add-participant-btn"
                icon="fas fa-plus"
                aria-label={t('messages.invite.title')}
                onclick={() => app.modal.show(InviteModal, { dialog })}
              />
            </Tooltip>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** "Tem certeza de que quer remover @fulano desta mensagem?" */
function removeParticipant(dialog: Dialog, user: User): void {
  if (!confirm(t('messages.topic.remove_confirm', { name: user.username() }))) return;

  app
    .request({ method: 'DELETE', url: `${app.forum.attribute('apiUrl')}/dialogs/${dialog.id()}/canela-membership`, params: { userId: user.id() } })
    .then(() => app.store.find('dialogs', dialog.id()!, { include: 'users.groups' }))
    .then(() => m.redraw())
    .catch(() => {});
}

// ---------------------------------------------------------------------
// Posts de ação pequena (convidou / removeu / saiu)
// ---------------------------------------------------------------------

export interface DialogEvent {
  id: number;
  type: 'invited_user' | 'invited_group' | 'removed_user' | 'user_left';
  createdAt: string;
  actorId: string | null;
  actorUsername: string | null;
  targetUserId: string | null;
  targetUsername: string | null;
  groupName: string | null;
}

export function dialogEvents(dialog: Dialog): DialogEvent[] {
  const events = dialog.attribute<DialogEvent[] | undefined>('canelaEvents');

  return Array.isArray(events) ? events : [];
}

const EVENT_ICONS: Record<string, string> = {
  invited_user: 'fas fa-circle-plus',
  invited_group: 'fas fa-circle-plus',
  removed_user: 'fas fa-circle-minus',
  user_left: 'fas fa-circle-minus',
};

/**
 * A small action do Discourse (`.small-action`): o ícone na coluna do
 * avatar, o avatar de quem fez e "Convidou @fulano há 2 dias".
 */
export function DialogEventView(event: DialogEvent): Mithril.Children {
  const actor = event.actorId ? app.store.getById<User>('users', event.actorId) : null;
  const target = event.targetUserId ? app.store.getById<User>('users', event.targetUserId) : null;
  const when = humanTime(new Date(event.createdAt));
  const who =
    event.type === 'invited_group' ? (
      <span className="CanelaDialogEvent-who">{event.groupName}</span>
    ) : target ? (
      <Link href={app.route.user(target)} className="CanelaDialogEvent-who">
        @{target.username()}
      </Link>
    ) : (
      <span className="CanelaDialogEvent-who">@{event.targetUsername || event.actorUsername}</span>
    );

  return (
    <div className={`CanelaDialogEvent CanelaDialogEvent--${event.type}`} key={`event-${event.id}`}>
      <span className="CanelaDialogEvent-icon">
        <Icon name={EVENT_ICONS[event.type] || 'fas fa-circle-info'} />
      </span>
      <span className="CanelaDialogEvent-avatar">{actor ? <Avatar user={actor} title={actor.username()} /> : null}</span>
      <span className="CanelaDialogEvent-text">{app.translator.trans(`ramon-canela.forum.messages.events.${event.type}`, { who, when })}</span>
    </div>
  );
}

// ---------------------------------------------------------------------
// Convidar
// ---------------------------------------------------------------------

interface InviteModalAttrs extends IFormModalAttrs {
  dialog: Dialog;
}

/**
 * "Convidar" (`invite` do tópico de mensagem): o mesmo seletor de pessoas e
 * grupos do composer e "✉ Enviar convite", desabilitado até alguém ser
 * escolhido.
 */
export class InviteModal extends FormModal<InviteModalAttrs> {
  users = Stream<User[]>([]);
  group = Stream<number | null>(null);

  className(): string {
    return 'Modal--small CanelaDialogInviteModal';
  }

  title(): Mithril.Children {
    return t('messages.invite.title');
  }

  content(): Mithril.Children {
    const ready = this.users().length > 0 || !!this.group();

    return (
      <div className="Modal-body">
        <p className="CanelaDialogInviteModal-help">{t('messages.invite.help')}</p>
        <div className="Form-group CanelaDialogInviteModal-field">
          <RecipientChooser
            className="CanelaDialogInviteModal-chooser"
            recipients={this.users}
            group={messageGroup() ? this.group : undefined}
            max={20}
            placeholder={t('messages.invite.placeholder')}
          />
        </div>
        <div className="Form-group">
          <Button
            className="Button Button--primary CanelaDialogInviteModal-submit"
            type="submit"
            icon="fas fa-envelope"
            loading={this.loading}
            disabled={!ready}
          >
            {t('messages.invite.submit')}
          </Button>
        </div>
      </div>
    );
  }

  onsubmit(e: SubmitEvent): void {
    e.preventDefault();

    const dialog = this.attrs.dialog;

    this.loading = true;

    app
      .request({
        method: 'POST',
        url: `${app.forum.attribute('apiUrl')}/dialogs/${dialog.id()}/canela-invite`,
        body: { userIds: this.users().map((user: User) => Number(user.id())), groupId: this.group() || undefined },
        // O erro (grupo que não recebe mensagens, limite de destinatários)
        // aparece dentro do modal, como no Discourse, e não atrás dele.
        errorHandler: this.onerror.bind(this),
      })
      // Recarrega a conversa: o grupo entra no mapa e o post de ação
      // "Convidou Admins" aparece na linha da conversa.
      .then(() => app.store.find('dialogs', dialog.id()!, { include: 'users.groups' }))
      .then(() => {
        app.alerts.show({ type: 'success' }, t(this.group() && !this.users().length ? 'messages.invite.success_group' : 'messages.invite.success'));
        this.hide();
      })
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }
}

// ---------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------

interface DialogTimelineAttrs extends ComponentAttrs {
  dialog: Dialog;
  onreply: () => void;
}

/**
 * A linha do tempo do tópico, no tamanho de uma mensagem: a data da primeira
 * no topo, a trilha com "n/n" e a data da última, a data embaixo e os botões
 * redondos de responder e de notificação.
 */
export class DialogTimeline extends Component<DialogTimelineAttrs> {
  view(): Mithril.Children {
    const dialog = this.attrs.dialog;
    const count = Math.max(1, messageCount(dialog));
    const first = dialog.createdAt();
    const last = dialog.lastMessageAt() || first;

    return (
      <div className="CanelaDialogTimeline" aria-hidden="false">
        <div className="CanelaDialogTimeline-date CanelaDialogTimeline-date--start">{first ? shortDate(first) : ''}</div>
        <div className="CanelaDialogTimeline-track">
          <div className="CanelaDialogTimeline-handle">
            <strong className="CanelaDialogTimeline-count">
              {count}/{count}
            </strong>
            <span className="CanelaDialogTimeline-handleDate">{last ? shortDate(last) : ''}</span>
          </div>
        </div>
        <div className="CanelaDialogTimeline-date CanelaDialogTimeline-date--end">{last ? shortDate(last) : ''}</div>
        <div className="CanelaDialogTimeline-controls">
          {dialog.canSendMessage() !== false ? (
            <Tooltip text={t('messages.topic.reply')}>
              <Button
                className="Button Button--icon CanelaDialogTimeline-reply"
                icon="fas fa-reply"
                aria-label={t('messages.topic.reply')}
                onclick={() => this.attrs.onreply()}
              />
            </Tooltip>
          ) : null}
          <DialogNotifications dialog={dialog} compact />
        </div>
      </div>
    );
  }
}

// ---------------------------------------------------------------------
// Notificações
// ---------------------------------------------------------------------

interface Level {
  value: number;
  key: 'watching' | 'tracking' | 'regular' | 'muted';
  icon: string;
}

/** Os níveis do Discourse para mensagens (`watching_pm` … `muted_pm`). */
const LEVELS: Level[] = [
  { value: 3, key: 'watching', icon: 'fas fa-bell' },
  { value: 2, key: 'tracking', icon: 'far fa-bell' },
  { value: 1, key: 'regular', icon: 'far fa-bell' },
  { value: 0, key: 'muted', icon: 'fas fa-bell-slash' },
];

function currentLevel(dialog: Dialog): Level {
  const value = dialog.attribute<number | null | undefined>('canelaNotificationLevel');

  return LEVELS.find((level) => level.value === (typeof value === 'number' ? value : 3)) || LEVELS[0];
}

/** Com o backend e a migration de grupos: o nível vem no diálogo. */
export function levelsOn(dialog: Dialog): boolean {
  return boxesOn() && typeof dialog.attribute('canelaNotificationLevel') === 'number';
}

interface DialogNotificationsAttrs extends ComponentAttrs {
  dialog: Dialog;
  compact?: boolean;
}

export class DialogNotifications extends Component<DialogNotificationsAttrs> {
  view(): Mithril.Children {
    const dialog = this.attrs.dialog;

    if (!levelsOn(dialog)) return null;

    const current = currentLevel(dialog);
    const compact = !!this.attrs.compact;

    return (
      <Dropdown
        className={classList(
          'CanelaNotifications',
          `CanelaNotifications--${current.key === 'watching' ? 'watching' : current.key === 'muted' ? 'muted' : 'normal'}`,
          { 'CanelaNotifications--compact': compact }
        )}
        buttonClassName={classList('Button CanelaNotifications-button', { 'Button--icon': compact })}
        menuClassName="CanelaNotifications-menu"
        icon={current.icon}
        noStyleOverride
        label={compact ? '' : t(`messages.notifications.${current.key}`)}
        caretIcon={compact ? '' : 'fas fa-caret-down'}
        accessibleToggleLabel={t(`messages.notifications.${current.key}`)}
        tooltip={compact ? t(`messages.notifications.${current.key}`) : undefined}
      >
        {LEVELS.map((level) => (
          <DetailedDropdownItem
            icon={<Icon name={level.icon} className="Button-icon" noStyleOverride />}
            label={t(`messages.notifications.${level.key}`)}
            description={t(`messages.notifications.${level.key}_description`)}
            active={level.value === current.value}
            onclick={() => {
              if (level.value !== current.value) dialog.save({ canelaNotificationLevel: level.value }).catch(() => {});
            }}
          />
        ))}
      </Dropdown>
    );
  }
}

/** "Você receberá notificações porque…" — o texto ao lado do botão no rodapé. */
export function notificationReason(dialog: Dialog): string {
  return t(`messages.notifications.${currentLevel(dialog).key}_reason`);
}
