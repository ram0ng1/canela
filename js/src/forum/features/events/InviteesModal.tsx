/*
 * "Participantes": quem respondeu ao evento, em abas (Vou, Interessados, Não
 * vou). Cada aba pede a lista ao abrir (GET /api/canela-events/{id}/invitees?filter[status]=…),
 * que traz as pessoas como `users` só com o público e as contagens em `meta`.
 */
import app from 'flarum/forum/app';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { apiUrl, personModel, type EventData, type EventPerson, type EventsDocument, type RsvpStatus } from './model';
import { t } from '../../utils/settings';

export interface InviteesModalAttrs extends IInternalModalAttrs {
  event: EventData;
  title: string;
}

const TABS: RsvpStatus[] = ['going', 'interested', 'not_going'];

export default class InviteesModal extends Modal<InviteesModalAttrs> {
  private tab: RsvpStatus = 'going';
  private lists: Partial<Record<RsvpStatus, EventPerson[]>> = {};
  private counts: Record<string, number> = {};

  oninit(vnode: Mithril.Vnode<InviteesModalAttrs, this>) {
    super.oninit(vnode);

    const event = this.attrs.event;

    this.counts = { going: event.going, interested: event.interested, not_going: event.notGoing };
    this.load('going');
  }

  className() {
    return 'CanelaInviteesModal Modal--small';
  }

  title() {
    return t('events.invitees_title', { title: this.attrs.title });
  }

  private load(status: RsvpStatus): void {
    if (this.lists[status]) return;

    app
      .request<EventsDocument>({
        method: 'GET',
        url: apiUrl(`/canela-events/${this.attrs.event.id}/invitees`),
        params: { filter: { status } },
      })
      .then((payload) => {
        const people = Array.isArray(payload.data) ? payload.data : [];

        this.lists[status] = people.map((user) => ({ ...(user.attributes || {}), id: user.id }) as EventPerson);
        this.counts = payload.meta?.counts || this.counts;
        m.redraw();
      })
      .catch(() => {
        this.lists[status] = [];
        m.redraw();
      });
  }

  content() {
    const people = this.lists[this.tab];

    return (
      <div className="Modal-body">
        <div className="CanelaInviteesModal-tabs" role="tablist">
          {TABS.map((status) => (
            <button
              type="button"
              role="tab"
              aria-selected={this.tab === status ? 'true' : 'false'}
              className={classList('Button Button--flat CanelaInviteesModal-tab', { active: this.tab === status })}
              onclick={() => {
                this.tab = status;
                this.load(status);
              }}
            >
              {t(`events.tabs.${status}`)} <span className="CanelaInviteesModal-count">{this.counts[status] || 0}</span>
            </button>
          ))}
        </div>
        {!people ? (
          <LoadingIndicator />
        ) : people.length === 0 ? (
          <p className="CanelaInviteesModal-empty">{t('events.no_invitees')}</p>
        ) : (
          <ul className="CanelaInviteesModal-list">
            {people.map((person) => {
              const user = personModel(person);

              return (
                <li key={person.id}>
                  <Link href={app.route.user(user)} onclick={() => app.modal.close()}>
                    <Avatar user={user} />
                    <span className="CanelaInviteesModal-username">{person.username}</span>
                    {person.displayName !== person.username && <span className="CanelaInviteesModal-name">{person.displayName}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }
}
