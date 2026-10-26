import app from 'flarum/admin/app';
import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Select from 'flarum/common/components/Select';
import type Mithril from 'mithril';

import { trans } from '../../util';
import { KEY, errorText, grantBadge, searchUsers, type BadgeRow } from './api';

export interface GrantBadgeModalAttrs extends IFormModalAttrs {
  /** Os emblemas que aceitam concessão manual. */
  badges: BadgeRow[];
  badgeId?: string;
  ongrant: () => void;
}

const SEARCH_DELAY_MS = 250;

/**
 * Conceder um emblema: escolher o emblema e a pessoa (com
 * sugestões da busca de usuários), mais um motivo ou link opcional. A pessoa
 * recebe a notificação "Ganhou …".
 */
export default class GrantBadgeModal extends FormModal<GrantBadgeModalAttrs> {
  badgeId = '';
  username = '';
  reason = '';
  suggestions: { username: string; displayName: string }[] = [];
  error: string | null = null;
  done: string | null = null;
  searchTimer: ReturnType<typeof setTimeout> | undefined;

  oninit(vnode: Mithril.Vnode<GrantBadgeModalAttrs, this>) {
    super.oninit(vnode);

    this.badgeId = this.attrs.badgeId || this.attrs.badges[0]?.id || '';
  }

  className() {
    return 'CanelaGrantBadgeModal Modal--small';
  }

  title() {
    return trans(`${KEY}.grant_title`);
  }

  content() {
    const options = Object.fromEntries(this.attrs.badges.map((badge) => [badge.id, badge.attributes.name]));

    return (
      <div className="Modal-body">
        <div className="Form">
          {!this.attrs.badges.length ? (
            <p className="helpText">{trans(`${KEY}.grant_none`)}</p>
          ) : (
            <>
              <div className="Form-group">
                <label>{trans(`${KEY}.field_badge`)}</label>
                <Select options={options} value={this.badgeId} onchange={(value: string) => (this.badgeId = value)} />
              </div>
              <div className="Form-group">
                <label for="CanelaGrant-user">{trans(`${KEY}.field_user`)}</label>
                <input
                  id="CanelaGrant-user"
                  className="FormControl"
                  list="CanelaGrant-users"
                  autocomplete="off"
                  required
                  value={this.username}
                  placeholder={trans(`${KEY}.field_user_placeholder`)}
                  oninput={(event: InputEvent) => this.search((event.target as HTMLInputElement).value)}
                />
                <datalist id="CanelaGrant-users">
                  {this.suggestions.map((user) => (
                    <option value={user.username}>{user.displayName}</option>
                  ))}
                </datalist>
              </div>
              <div className="Form-group">
                <label for="CanelaGrant-reason">{trans(`${KEY}.field_reason`)}</label>
                <input
                  id="CanelaGrant-reason"
                  className="FormControl"
                  maxlength={500}
                  value={this.reason}
                  placeholder={trans(`${KEY}.field_reason_placeholder`)}
                  oninput={(event: InputEvent) => (this.reason = (event.target as HTMLInputElement).value)}
                />
              </div>
              {this.error && <p className="CanelaAdmin-formError">{this.error}</p>}
              {this.done && <p className="CanelaAdmin-formDone">{this.done}</p>}
              <div className="Form-group">
                <Button className="Button Button--primary" type="submit" loading={this.loading}>
                  {trans(`${KEY}.grant_submit`)}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  search(value: string): void {
    this.username = value;
    clearTimeout(this.searchTimer);

    if (value.trim().length < 2) {
      this.suggestions = [];
      return;
    }

    this.searchTimer = setTimeout(() => {
      searchUsers(value.trim())
        .then((users) => (this.suggestions = users))
        .catch(() => (this.suggestions = []))
        .finally(() => m.redraw());
    }, SEARCH_DELAY_MS);
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();

    this.loading = true;
    this.error = null;
    this.done = null;

    const username = this.username.trim();

    grantBadge(this.badgeId, username, this.reason.trim())
      .then(() => {
        // O modal fica aberto: conceder o mesmo emblema a várias pessoas
        // seguidas é o caso comum.
        this.done = trans(`${KEY}.grant_done`, { username });
        this.username = '';
        this.reason = '';
        this.attrs.ongrant();
      })
      .catch((error) => (this.error = errorText(error)))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }
}

export function openGrantModal(badges: BadgeRow[], badgeId: string | undefined, ongrant: () => void): void {
  app.modal.show(GrantBadgeModal, { badges, badgeId, ongrant });
}
