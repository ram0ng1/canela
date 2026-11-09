/*
 * "Atribuir tópico": busca o usuário pelo nome e grava o responsável
 * (`canelaAssignee`) no tópico. Com alguém atribuído, também dá para remover.
 */
import app from 'flarum/forum/app';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Avatar from 'flarum/common/components/Avatar';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import username from 'flarum/common/helpers/username';
import Stream from 'flarum/common/utils/Stream';
import { debounce } from 'flarum/common/utils/throttleDebounce';
import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import saveAssignee from './save';

interface AssistantData {
  id: number;
}

export interface AssignModalAttrs extends IInternalModalAttrs {
  discussion: Discussion;
}

export default class AssignModal extends Modal<AssignModalAttrs> {
  query = Stream('');
  results: User[] = [];
  searching = false;
  saving = false;

  className() {
    return 'CanelaAssignModal Modal--small';
  }

  title() {
    return t('assign.title');
  }

  content(): Mithril.Children {
    const current = (this.attrs.discussion as any).canelaAssignee?.() || null;
    const me = app.session.user;
    const bot = app.forum.attribute<AssistantData | null>('canelaAssistant');
    const assistant = bot ? app.store.getById<User>('users', String(bot.id)) : null;

    // Atalhos acima da busca: a própria pessoa e o assistente de IA.
    const shortcuts = [me, assistant].filter((user): user is User => !!user && user !== current);

    const searching = this.query().trim().length >= 2;
    const list = searching ? this.results.filter((user) => user !== current) : shortcuts;

    return (
      <div className="Modal-body">
        {current ? (
          <div className="CanelaAssignModal-current">
            <Avatar user={current} />
            <span className="CanelaAssignModal-info">
              <span className="CanelaAssignModal-caption">{t('assign.current')}</span>
              <span className="CanelaAssignModal-name">{username(current)}</span>
            </span>
            <Button className="Button Button--text CanelaAssignModal-remove" icon="fas fa-user-xmark" disabled={this.saving} onclick={() => this.assign(null)}>
              {t('assign.remove_short')}
            </Button>
          </div>
        ) : null}
        <div className="CanelaAssignModal-search">
          <i className="icon fas fa-magnifying-glass" aria-hidden="true" />
          <input
            className="FormControl"
            type="search"
            placeholder={t('assign.placeholder')}
            value={this.query()}
            oninput={(event: InputEvent) => {
              this.query((event.target as HTMLInputElement).value);
              this.search();
            }}
            oncreate={(vnode: Mithril.VnodeDOM) => (vnode.dom as HTMLInputElement).focus()}
          />
        </div>
        {!searching && list.length ? <div className="CanelaAssignModal-caption CanelaAssignModal-section">{t('assign.suggestions')}</div> : null}
        <ul className="CanelaAssignModal-results">
          {list.map((user) => (
            <li>{this.userButton(user, searching ? undefined : user === me ? t('assign.assign_self') : t('assign.assistant'))}</li>
          ))}
        </ul>
        {this.searching ? <LoadingIndicator size="small" /> : null}
        {searching && !this.searching && !list.length ? <p className="CanelaAssignModal-empty">{t('assign.empty')}</p> : null}
      </div>
    );
  }

  userButton(user: User, hint?: string): Mithril.Children {
    return (
      <button type="button" className="CanelaAssignModal-user" disabled={this.saving} onclick={() => this.assign(user)}>
        <Avatar user={user} />
        <span className="CanelaAssignModal-info">
          <span className="CanelaAssignModal-name">{username(user)}</span>
          <span className="CanelaAssignModal-handle">{hint || `@${user.username()}`}</span>
        </span>
        <i className="icon fas fa-chevron-right CanelaAssignModal-go" aria-hidden="true" />
      </button>
    );
  }

  oninit(vnode: Mithril.Vnode<AssignModalAttrs, this>) {
    super.oninit(vnode);

    // O assistente nem sempre está no store: busca para o atalho aparecer.
    const bot = app.forum.attribute<AssistantData | null>('canelaAssistant');

    if (bot && !app.store.getById('users', String(bot.id))) {
      app.store
        .find<User>('users', String(bot.id))
        .then(() => m.redraw())
        .catch(() => {});
    }
  }

  search = debounce(250, () => {
    const q = this.query().trim();

    if (q.length < 2) {
      this.results = [];
      m.redraw();
      return;
    }

    this.searching = true;
    m.redraw();

    app.store
      .find<User[]>('users', { filter: { q }, page: { limit: 6 } })
      .then((users) => (this.results = [...users]))
      .catch(() => (this.results = []))
      .finally(() => {
        this.searching = false;
        m.redraw();
      });
  });

  assign(user: User | null) {
    this.saving = true;

    saveAssignee(this.attrs.discussion, user)
      .then(() => this.hide())
      .catch(() => {})
      .finally(() => {
        this.saving = false;
        m.redraw();
      });
  }
}
