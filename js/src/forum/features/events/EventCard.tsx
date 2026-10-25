/*
 * O cartão do evento no primeiro post:
 *
 *   ┌────┐ Nome do evento                                   (…)
 *   │OUT │ Público · Criado por [avatar] Fulano
 *   │ 22 │
 *   ⏱  qui, 22 out 10:00 → 11:00 (São Paulo)
 *   ↻  A cada duas semanas, quinta-feira
 *   👥 [avatares com ✓]
 *   📄 descrição
 *   [✓ Eu vou ▾] [☆ Interessado] [✕ Não vou]
 *
 * O bloco que o servidor desenhou (`.CanelaEvent`) continua no post: o cartão
 * entra dentro dele, e a descrição (já em HTML) é levada para a seção dela.
 * A presença vai pela API e o cartão novo volta no mesmo pedido.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import Tooltip from 'flarum/common/components/Tooltip';
import classList from 'flarum/common/utils/classList';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { downloadIcs, googleCalendarUrl } from './calendar';
import { eventRange, monthShort, readerZone, recurrenceLabel } from './format';
import { apiUrl, eventsSettings, personModel, postEvent, type EventData, type RsvpStatus } from './model';
import { openChannel } from '../../thirdparty/ramonChat/bridge';
import { t } from '../../utils/settings';

export interface EventCardAttrs extends ComponentAttrs {
  post: Post;
  /** A descrição que o servidor desenhou, levada para dentro do cartão. */
  description: HTMLElement | null;
}

const InviteesModal = () => import('./InviteesModal');

export async function rsvp(post: Post, event: EventData, status: RsvpStatus | null): Promise<void> {
  const payload = await app.request<{ event: EventData }>({
    method: 'POST',
    url: apiUrl(`/canela-events/${event.id}/rsvp`),
    body: { status },
  });

  if (payload?.event) post.pushAttributes({ canelaEvent: payload.event });
}

export default class EventCard extends Component<EventCardAttrs> {
  private busy: string | null = null;

  oncreate(vnode: Mithril.VnodeDOM<EventCardAttrs, this>): void {
    super.oncreate(vnode);
    this.placeDescription();
  }

  onupdate(vnode: Mithril.VnodeDOM<EventCardAttrs, this>): void {
    super.onupdate(vnode);
    this.placeDescription();
  }

  /** A descrição do servidor entra na seção dela (uma vez; o nó fica lá). */
  private placeDescription(): void {
    const slot = this.element?.querySelector('.CanelaEventCard-descriptionSlot');
    const description = this.attrs.description;

    if (slot && description && description.parentElement !== slot && description.textContent?.trim()) slot.appendChild(description);
  }

  view(): Mithril.Children {
    const post = this.attrs.post;
    const event = postEvent(post);

    if (!event) return null;

    const discussion = post.discussion();
    const title = event.name || discussion?.title() || '';
    const start = new Date(event.startsAt);
    const end = event.endsAt ? new Date(event.endsAt) : null;
    const hasDescription = !!this.attrs.description?.textContent?.trim();

    return (
      <div className={classList('CanelaEventCard', { 'CanelaEventCard--ended': event.ended })}>
        <header className="CanelaEventCard-header">
          <div className="CanelaEventCard-date" aria-hidden="true">
            <span className="CanelaEventCard-month">{monthShort(start)}</span>
            <span className="CanelaEventCard-day">{start.getDate()}</span>
          </div>
          <div className="CanelaEventCard-info">
            <span className="CanelaEventCard-name">{title}</span>
            <div className="CanelaEventCard-statusLine">
              <span className="CanelaEventCard-status">{t(`events.status.${event.ended ? 'ended' : event.status}`)}</span>
              {event.creator && (
                <>
                  <span className="CanelaEventCard-separator">·</span>
                  <span className="CanelaEventCard-creator">
                    <span className="CanelaEventCard-createdBy">{t('events.created_by')}</span>
                    <Link href={app.route.user(personModel(event.creator))}>
                      <Avatar user={personModel(event.creator)} />
                      {event.creator.displayName}
                    </Link>
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="CanelaEventCard-controls">{this.moreMenu(event, title)}</div>
        </header>

        <section className="CanelaEventCard-section CanelaEventCard-dates">
          <Icon name="far fa-clock" />
          <p>
            <Tooltip text={event.timezone ? `${event.timezone}` : t('events.local_time')}>
              <span className="CanelaEventCard-dateText">
                {eventRange(start, end)}
                {readerZone() && <span className="CanelaEventCard-zone"> ({readerZone()})</span>}
              </span>
            </Tooltip>
          </p>
        </section>

        {event.recurrence && (
          <section className="CanelaEventCard-section CanelaEventCard-recurrence">
            <Icon name="fas fa-arrows-rotate" />
            <p>{recurrenceLabel(event.recurrence, new Date(event.firstStartsAt))}</p>
          </section>
        )}

        {event.location && (
          <section className="CanelaEventCard-section CanelaEventCard-location">
            <Icon name="fas fa-location-dot" />
            <p>{event.location}</p>
          </section>
        )}

        {event.url && (
          <section className="CanelaEventCard-section CanelaEventCard-url">
            <Icon name="fas fa-video" />
            <p>
              <a href={event.url} target="_blank" rel="noopener noreferrer nofollow ugc">
                {this.urlLabel(event.url)}
              </a>
            </p>
          </section>
        )}

        {event.status !== 'standalone' && this.invitees(event)}

        {hasDescription && (
          <section className="CanelaEventCard-section CanelaEventCard-description">
            <Icon name="far fa-file-lines" />
            <div className="CanelaEventCard-descriptionSlot" />
          </section>
        )}

        {event.chatChannelId && !this.chatDocked() && (
          <section className="CanelaEventCard-section CanelaEventCard-chat">
            <Icon name="far fa-comments" />
            <p>
              <Button className="Button Button--link CanelaEventCard-chatLink" onclick={() => openChannel(event.chatChannelId!)}>
                {t('events.open_chat')}
              </Button>
            </p>
          </section>
        )}

        {this.actions(post, event)}
      </div>
    );
  }

  /** O chat já está ao lado do tópico (o modo encaixado, no computador). */
  private chatDocked(): boolean {
    return eventsSettings.dockedChat() && app.screen() !== 'phone' && document.body.classList.contains('CanelaEventChat--docked');
  }

  private urlLabel(url: string): string {
    try {
      const parsed = new URL(url);

      return /zoom\.us|youtube|youtu\.be|twitch|meet\.google|teams\.microsoft/.test(parsed.host)
        ? t('events.join_livestream', { host: parsed.host })
        : url;
    } catch {
      return url;
    }
  }

  private invitees(event: EventData): Mithril.Children {
    if (!event.going && !event.interested) return null;

    const open = () => app.modal.show(InviteesModal, { event, title: event.name || this.attrs.post.discussion()?.title() || '' });

    return (
      <section className="CanelaEventCard-section CanelaEventCard-invitees">
        <button type="button" className="Button--ua-reset CanelaEventCard-inviteesIcon" onclick={open} aria-label={t('events.see_invitees')}>
          <Icon name="fas fa-users" />
          <sub>{event.going}</sub>
        </button>
        <ul className="CanelaEventCard-avatars">
          {event.sample.map((person) => (
            <li key={person.id} className="CanelaEventCard-invitee">
              <button type="button" className="Button--ua-reset" onclick={open} title={person.displayName}>
                <Avatar user={personModel(person)} />
                <span className="CanelaEventCard-check" aria-hidden="true">
                  <Icon name="fas fa-check" />
                </span>
              </button>
            </li>
          ))}
        </ul>
        {event.maxAttendees ? (
          <span className="CanelaEventCard-capacity">{t('events.capacity', { going: event.going, max: event.maxAttendees })}</span>
        ) : null}
      </section>
    );
  }

  private moreMenu(event: EventData, title: string): Mithril.Children {
    const link = window.location.origin + app.route.discussion(this.attrs.post.discussion()!);

    return (
      <Dropdown
        className="CanelaEventCard-more"
        buttonClassName="Button Button--icon"
        menuClassName="Dropdown-menu--right"
        icon="fas fa-ellipsis"
        caretIcon=""
        label=""
        accessibleToggleLabel={t('events.more')}
      >
        <a className="Button" href={googleCalendarUrl(event, title, link)} target="_blank" rel="noopener noreferrer">
          <Icon name="fab fa-google" className="Button-icon" />
          <span className="Button-label">{t('events.add_google')}</span>
        </a>
        <Button icon="far fa-calendar-plus" onclick={() => downloadIcs(event, title, link)}>
          {t('events.add_ics')}
        </Button>
        {event.status !== 'standalone' && (
          <Button icon="fas fa-users" onclick={() => app.modal.show(InviteesModal, { event, title })}>
            {t('events.see_invitees')}
          </Button>
        )}
        {event.chatChannelId && (
          <Button icon="far fa-comments" onclick={() => openChannel(event.chatChannelId!)}>
            {t('events.open_chat')}
          </Button>
        )}
      </Dropdown>
    );
  }

  private actions(post: Post, event: EventData): Mithril.Children {
    if (event.status === 'standalone') return null;

    if (event.ended) {
      return (
        <section className="CanelaEventCard-actions CanelaEventCard-actions--ended">
          <span>{t('events.ended_notice')}</span>
        </section>
      );
    }

    if (!event.canRsvp) {
      return app.session.user ? null : (
        <section className="CanelaEventCard-actions">
          <Button
            className="Button"
            icon="fas fa-right-to-bracket"
            onclick={() => app.modal.show(() => import('flarum/forum/components/LogInModal'))}
          >
            {t('events.login_to_rsvp')}
          </Button>
        </section>
      );
    }

    const answer = (status: RsvpStatus | null) => {
      if (this.busy) return;

      this.busy = status || 'remove';
      rsvp(post, event, status).finally(() => {
        this.busy = null;
        m.redraw();
      });
    };
    const mine = event.myStatus;
    const fullForMe = event.full && mine !== 'going';

    return (
      <section className={classList('CanelaEventCard-actions', mine && `CanelaEventCard-actions--${mine}`)}>
        <div className={classList('CanelaEventCard-going', { 'CanelaEventCard-going--on': mine === 'going' })}>
          <Button
            className={classList('Button', mine === 'going' ? 'Button--primary' : '')}
            icon="fas fa-check"
            loading={this.busy === 'going'}
            disabled={fullForMe}
            onclick={() => answer(mine === 'going' ? null : 'going')}
          >
            {fullForMe ? t('events.full') : t('events.going')}
          </Button>
          {mine === 'going' && (
            <Dropdown
              className="CanelaEventCard-goingMenu"
              buttonClassName="Button Button--primary Button--icon"
              menuClassName="Dropdown-menu--right"
              icon="fas fa-chevron-down"
              caretIcon=""
              label=""
              accessibleToggleLabel={t('events.more')}
            >
              <Button icon="fas fa-xmark" onclick={() => answer(null)}>
                {t('events.remove_answer')}
              </Button>
            </Dropdown>
          )}
        </div>
        <Button
          className={classList('Button', { 'Button--primary': mine === 'interested' })}
          icon={mine === 'interested' ? 'fas fa-star' : 'far fa-star'}
          loading={this.busy === 'interested'}
          onclick={() => answer(mine === 'interested' ? null : 'interested')}
        >
          {t('events.interested')}
        </Button>
        <Button
          className={classList('Button', { 'Button--primary': mine === 'not_going' })}
          icon="fas fa-xmark"
          loading={this.busy === 'not_going'}
          onclick={() => answer(mine === 'not_going' ? null : 'not_going')}
        >
          {t('events.not_going')}
        </Button>
      </section>
    );
  }
}
