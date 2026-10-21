/*
 * A aba "Rascunhos" do perfil (`/u/:username/drafts`),
 * com os rascunhos do fof/drafts: só a própria pessoa a vê. Cada rascunho
 * mostra o tipo (tópico novo, resposta, mensagem), o título, o começo do
 * texto e há quanto tempo foi mexido, com "Continuar" e "Excluir".
 */
import app from 'flarum/forum/app';
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Placeholder from 'flarum/common/components/Placeholder';
import { truncate } from 'flarum/common/utils/string';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import {
  allDrafts,
  deleteDraft,
  draftIcon,
  draftsOn,
  draftTitle,
  ensureDiscussions,
  fofState,
  loadDrafts,
  openDraft,
  type FofDraft,
} from './fofDrafts';
import { fullDate, shortAge } from '../../../utils/dates';
import { t } from '../../../utils/settings';

const TYPE_KEYS = {
  discussion: 'type_new_topic',
  reply: 'type_reply',
  privateDiscussion: 'type_message',
};

export default class DraftsUserPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  private loading = true;

  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    // Rascunhos são de quem escreveu: no perfil de outra pessoa a aba não
    // existe, e a URL digitada à mão leva às postagens dela.
    if (user !== app.session.user || !draftsOn()) {
      m.route.set(app.route('user.posts', { username: user.slug() }), undefined, { replace: true });
      return;
    }

    super.show(user);

    loadDrafts().then(() => {
      this.loading = false;
      m.redraw();
    });
  }

  content() {
    if (this.loading) return <LoadingIndicator />;

    const drafts = allDrafts();
    const state = fofState();

    if (!drafts.length) return <Placeholder text={t('composer.drafts.empty')} />;

    ensureDiscussions(drafts);

    return (
      <div className="CanelaDrafts">
        <ul className="CanelaDrafts-list">{drafts.map((draft) => this.item(draft))}</ul>
        {state?.hasNextPage && (
          <div className="CanelaDrafts-more">
            <Button className="Button" loading={state.loadingMore} onclick={() => state.loadMore()}>
              {t('composer.drafts.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  private item(draft: FofDraft): Mithril.Children {
    const type = draft.type();
    const updated = draft.updatedAt();
    const text = (draft.content() || '').replace(/\s+/g, ' ').trim();

    return (
      <li key={draft.id()} className={`CanelaDrafts-item CanelaDrafts-item--${type}`}>
        <span className="CanelaDrafts-icon" aria-hidden="true">
          <Icon name={draftIcon(draft)} />
        </span>
        <div className="CanelaDrafts-main">
          <div className="CanelaDrafts-context">
            {t(`composer.drafts.${TYPE_KEYS[type] || 'type_new_topic'}`)}
            {updated && (
              <time className="CanelaDrafts-time" dateTime={updated.toISOString()} title={fullDate(updated)}>
                {' · '}
                {shortAge(updated)}
              </time>
            )}
          </div>
          <h3 className="CanelaDrafts-title">{draftTitle(draft)}</h3>
          {text && <p className="CanelaDrafts-excerpt">{truncate(text, 200)}</p>}
        </div>
        <div className="CanelaDrafts-actions">
          <Button className="Button Button--primary" icon="fas fa-pen" onclick={() => openDraft(draft)}>
            {t('composer.drafts.resume')}
          </Button>
          <Button
            className="Button Button--icon CanelaDrafts-delete"
            icon="far fa-trash-can"
            aria-label={t('composer.drafts.delete')}
            title={t('composer.drafts.delete')}
            onclick={() => deleteDraft(draft)}
          />
        </div>
      </li>
    );
  }
}
