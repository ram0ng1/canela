/*
 * (6) "Nova mensagem" para o ramon/chat: a busca de pessoas, as
 * escolhidas em pílulas, o contador "2/20 participantes", o nome do chat em
 * grupo (opcional, com duas pessoas ou mais) e "Anotar algo" (a MD consigo
 * mesmo). Uma pessoa abre a MD com ela; várias, o chat em grupo — tudo pelo
 * `/api/chat/direct` do ramon/chat, que acha a conversa que já existe.
 *
 * Chunk próprio: aberto por `openNewMessage()` (newMessage.ts).
 */
import app from 'flarum/forum/app';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { chatState, openChannel } from '../bridge';
import { apiUrl, ct, dmMax, feature, rt } from './flags';

const SEARCH_DELAY = 200;

export default class NewMessageModal extends Modal<IInternalModalAttrs> {
  private query = '';
  private results: User[] = [];
  private selected: User[] = [];
  private groupName = '';
  private searching = false;
  private busy = false;
  private active = 0;
  private timer: number | null = null;
  private sequence = 0;

  oninit(vnode: Mithril.Vnode<IInternalModalAttrs, this>) {
    super.oninit(vnode);

    this.search();
  }

  className() {
    return 'CanelaRamonNewMessage Modal--small';
  }

  title() {
    return ct('direct_message_creator.title');
  }

  content() {
    const max = dmMax();
    const group = this.selected.length >= 2;
    const full = this.selected.length + 1 >= max;

    return (
      <div className="Modal-body">
        <div className="CanelaRamonNewMessage-picker">
          <div className="CanelaRamonNewMessage-chips" onclick={(e: MouseEvent) => (e.currentTarget as HTMLElement).querySelector('input')?.focus()}>
            <Icon name="fas fa-magnifying-glass" />
            {this.selected.map((user) => (
              <button
                type="button"
                className="Button CanelaRamonNewMessage-chip"
                title={ct('direct_message_creator.selected_user_title', { username: user.username() })}
                onclick={() => this.toggle(user)}
              >
                <Avatar user={user} />
                <span>{user.displayName()}</span>
                <Icon name="fas fa-xmark" />
              </button>
            ))}
            <input
              className="FormControl CanelaRamonNewMessage-input"
              type="text"
              autofocus
              placeholder={this.selected.length ? ct('new_message_modal.user_search_placeholder') : rt('new_message.search_placeholder')}
              value={this.query}
              oninput={(e: InputEvent) => {
                this.query = (e.target as HTMLInputElement).value;
                this.search();
              }}
              onkeydown={(e: KeyboardEvent) => this.onKeyDown(e)}
              aria-label={rt('new_message.search_placeholder')}
            />
          </div>

          <div className="CanelaRamonNewMessage-counter" aria-live="polite">
            {ct('new_message_modal.participants_counter', { selection_count: this.selected.length + 1, max })}
          </div>

          {group && feature('group_name') && (
            <input
              className="FormControl CanelaRamonNewMessage-groupName"
              placeholder={ct('new_message_modal.create_group_placeholder')}
              maxlength={50}
              value={this.groupName}
              oninput={(e: InputEvent) => (this.groupName = (e.target as HTMLInputElement).value)}
            />
          )}

          <ul className="CanelaRamonNewMessage-results" role="listbox">
            {feature('self_dm') && !this.selected.length && !this.query.trim() && (
              <li>
                <button type="button" className="CanelaRamonNewMessage-result --self" disabled={this.busy} onclick={() => this.openSelf()}>
                  <Avatar user={app.session.user!} />
                  <span className="CanelaRamonNewMessage-name">{app.session.user!.displayName()}</span>
                  <span className="CanelaRamonNewMessage-hint">{ct('placeholder_self')}</span>
                </button>
              </li>
            )}
            {this.searching && !this.results.length ? (
              <li className="CanelaRamonNewMessage-loading">
                <LoadingIndicator size="small" display="inline" />
              </li>
            ) : null}
            {!this.searching && !this.results.length && this.query.trim() ? (
              <li className="CanelaRamonNewMessage-empty">{ct('new_message_modal.no_items')}</li>
            ) : null}
            {this.results.map((user, index) => {
              const chosen = this.selected.includes(user);

              return (
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={chosen ? 'true' : 'false'}
                    className={classList('CanelaRamonNewMessage-result', { active: index === this.active, chosen })}
                    disabled={!chosen && full}
                    onmouseenter={() => (this.active = index)}
                    onclick={(e: MouseEvent) => (e.shiftKey || this.selected.length ? this.toggle(user) : this.open([user]))}
                  >
                    <Avatar user={user} />
                    <span className="CanelaRamonNewMessage-name">{user.displayName()}</span>
                    <span className="CanelaRamonNewMessage-hint">@{user.username()}</span>
                    {chosen ? <Icon name="fas fa-check" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="helpText">{ct('new_message_modal.add_user_long', { username: this.results[this.active]?.username() || '…' })}</p>
        </div>

        <div className="Form-group CanelaRamonNewMessage-actions">
          <Button className="Button Button--primary" loading={this.busy} disabled={!this.selected.length} onclick={() => this.open(this.selected)}>
            {group ? ct('new_message_modal.create_new_group_chat') : rt('new_message.open')}
          </Button>
        </div>
      </div>
    );
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const count = this.results.length;
      if (count) this.active = (this.active + (e.key === 'ArrowDown' ? 1 : count - 1)) % count;
      return;
    }

    if (e.key === 'Backspace' && !this.query && this.selected.length) {
      this.selected.pop();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const user = this.results[this.active];

      if (user && (e.shiftKey || this.selected.length)) this.toggle(user);
      else if (user) this.open([user]);
      else if (this.selected.length) this.open(this.selected);
    }
  }

  private toggle(user: User): void {
    if (this.selected.includes(user)) this.selected = this.selected.filter((item) => item !== user);
    else if (this.selected.length + 1 < dmMax()) this.selected.push(user);

    this.query = '';
    this.search();
  }

  private search(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);

    const mine = ++this.sequence;
    const q = this.query.trim();

    this.searching = true;

    this.timer = window.setTimeout(() => {
      app.store
        .find<User[]>('users', { filter: q ? { q } : {}, page: { limit: 10 } } as any)
        .then((users) => {
          if (mine !== this.sequence) return;

          const me = app.session.user?.id();
          this.results = (Array.isArray(users) ? users : []).filter((user) => user.id() !== me);
          this.active = 0;
        })
        .catch(() => {})
        .then(() => {
          if (mine === this.sequence) this.searching = false;
          m.redraw();
        });
    }, SEARCH_DELAY);
  }

  /** O documento do canal (o mesmo do ramon/chat) entra no store e na lista dele. */
  private adopt(payload: any): number {
    const id = Number(payload?.data?.id);
    const state = chatState();

    if (!id || !state) return id;

    let channel: any = null;

    if (payload?.meta?.serialized) {
      try {
        channel = app.store.pushPayload(payload);
      } catch {
        channel = null;
      }
    }

    if (channel) state.rememberChannel(channel);
    if (payload?.meta?.created) state.seedEmptyChannel(id);

    return id;
  }

  private async open(users: User[]): Promise<void> {
    if (!users.length || this.busy) return;

    this.busy = true;

    try {
      const payload = await app.request<any>({
        method: 'POST',
        url: apiUrl('/chat/direct'),
        body: { data: { attributes: { userIds: users.map((user) => Number(user.id())) } } },
      });

      let id = this.adopt(payload);
      const name = this.groupName.trim();

      // O nome do grupo, pelo endpoint do tema (o ramon/chat não deixa o membro renomear).
      if (id && name && users.length >= 2 && feature('group_name')) {
        const renamed = await app
          .request<any>({ method: 'POST', url: apiUrl(`/chat-channels/${id}/canela-name`), body: { data: { attributes: { name } } } })
          .catch(() => null);

        if (renamed) id = this.adopt(renamed) || id;
      }

      this.hide();

      if (id) openChannel(id);
    } catch {
      // O alerta do core mostra o motivo (limite, chat desligado…).
    } finally {
      this.busy = false;
      m.redraw();
    }
  }

  private async openSelf(): Promise<void> {
    if (this.busy) return;

    this.busy = true;

    try {
      const payload = await app.request<any>({ method: 'POST', url: apiUrl('/chat-channels/canela-self') });
      const id = this.adopt(payload);

      this.hide();

      if (id) openChannel(id);
    } catch {
      // Idem.
    } finally {
      this.busy = false;
      m.redraw();
    }
  }
}
