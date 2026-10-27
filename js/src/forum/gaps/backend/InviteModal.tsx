/*
 * A janela de convites, num chunk próprio: só
 * desce quando alguém abre "Convidar" (barra lateral ou compartilhar).
 */
import app from 'flarum/forum/app';
import type { IInternalModalAttrs } from 'flarum/common/components/Modal';
import FormModal from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Stream from 'flarum/common/utils/Stream';
import type Mithril from 'mithril';

import { copyText } from '../utils/clipboard';
import { t } from '../../utils/settings';
import { fullDate } from '../../utils/dates';
import type Invite from './Invite';

export default class InviteModal extends FormModal<IInternalModalAttrs> {
  invites: Invite[] | null = null;
  signUpOpen = true;
  /** Falso para quem perdeu a permissão: a janela só lista e revoga. */
  canCreate = true;
  creating = false;
  copiedId: string | null = null;
  maxRedemptions = Stream('1');
  expiresDays = Stream('7');

  oninit(vnode: Mithril.Vnode<IInternalModalAttrs, this>) {
    super.oninit(vnode);
    this.load();
  }

  className() {
    return 'CanelaInviteModal Modal--medium';
  }

  title() {
    return t('gaps.invites.title');
  }

  load(): void {
    app.store
      .find<Invite[]>('canela-invites')
      .then((invites) => {
        const meta = (invites.payload?.meta || {}) as { signUpOpen?: boolean; canCreate?: boolean };

        this.invites = [...invites];
        this.signUpOpen = meta.signUpOpen ?? true;
        this.canCreate = meta.canCreate ?? true;
      })
      .catch(() => (this.invites = []))
      .finally(() => m.redraw());
  }

  content(): Mithril.Children {
    return (
      <div className="Modal-body">
        {!this.signUpOpen && <p className="CanelaInviteModal-warning">{t('gaps.invites.sign_up_closed')}</p>}
        <p className="CanelaInviteModal-help">{t('gaps.invites.help')}</p>

        {this.canCreate ? (
          <>
            <div className="CanelaInviteModal-options">
              <label>
                {t('gaps.invites.max_redemptions')}
                <input className="FormControl" type="number" min="1" max="100" bidi={this.maxRedemptions} />
              </label>
              <label>
                {t('gaps.invites.expires_days')}
                <input className="FormControl" type="number" min="1" max="90" bidi={this.expiresDays} />
              </label>
            </div>

            <Button className="Button Button--primary" icon="fas fa-link" loading={this.creating} type="submit">
              {t('gaps.invites.create')}
            </Button>
          </>
        ) : (
          <p className="CanelaInviteModal-help">{t('gaps.invites.cannot_create')}</p>
        )}

        <h4 className="CanelaInviteModal-listTitle">{t('gaps.invites.yours')}</h4>
        {this.invites === null ? <LoadingIndicator /> : this.list()}
      </div>
    );
  }

  list(): Mithril.Children {
    if (!this.invites || !this.invites.length) return <p className="CanelaInviteModal-empty">{t('gaps.invites.none')}</p>;

    return (
      <ul className="CanelaInviteModal-list">
        {this.invites.map((invite) => (
          <li className={invite.usable() ? '' : 'CanelaInviteModal-item--used'}>
            <input
              className="FormControl"
              type="text"
              readonly
              value={invite.url()}
              onfocus={(event: FocusEvent) => (event.target as HTMLInputElement).select()}
            />
            <span className="CanelaInviteModal-meta">
              {t('gaps.invites.uses', { used: invite.redemptionCount(), max: invite.maxRedemptions() })}
              {invite.expiresAt() && [' · ', t('gaps.invites.expires', { date: fullDate(invite.expiresAt()!) })]}
            </span>
            <Button
              className="Button Button--icon"
              icon={this.copiedId === invite.id() ? 'fas fa-check' : 'far fa-copy'}
              aria-label={t('gaps.share.copy')}
              title={t('gaps.share.copy')}
              onclick={() =>
                copyText(invite.url()).then((ok) => {
                  this.copiedId = ok ? invite.id()! : null;
                  m.redraw();
                })
              }
            />
            <Button
              className="Button Button--icon"
              icon="far fa-trash-can"
              aria-label={t('gaps.invites.delete')}
              title={t('gaps.invites.delete')}
              onclick={() => this.remove(invite)}
            />
          </li>
        ))}
      </ul>
    );
  }

  remove(invite: Invite): void {
    invite
      .delete()
      .then(() => {
        this.invites = (this.invites || []).filter((item) => item !== invite);
      })
      .catch(() => {})
      .finally(() => m.redraw());
  }

  onsubmit(event: SubmitEvent) {
    event.preventDefault();

    if (this.creating) return;

    this.creating = true;

    app.store
      .createRecord<Invite>('canela-invites')
      .save({ maxRedemptions: parseInt(this.maxRedemptions(), 10) || 1, expiresDays: parseInt(this.expiresDays(), 10) || 7 })
      .then((invite) => {
        this.invites = [invite, ...(this.invites || [])];
        copyText(invite.url()).then((ok) => {
          this.copiedId = ok ? invite.id()! : null;
          m.redraw();
        });
      })
      .catch(() => {})
      .finally(() => {
        this.creating = false;
        m.redraw();
      });
  }
}
