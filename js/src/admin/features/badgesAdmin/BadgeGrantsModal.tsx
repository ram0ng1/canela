import app from 'flarum/admin/app';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

import { trans } from '../../util';
import { KEY, errorText, loadGrants, revokeGrant, type BadgeRow, type GrantRow } from './api';

export interface BadgeGrantsModalAttrs extends IInternalModalAttrs {
  badge: BadgeRow;
  onchange: () => void;
}

/**
 * Quem ganhou um emblema, das concessões mais recentes às mais antigas, com
 * o "Revogar" de cada uma. Revogar apaga a concessão e a notificação dela.
 */
export default class BadgeGrantsModal extends Modal<BadgeGrantsModalAttrs> {
  rows: GrantRow[] = [];
  loadingRows = true;
  hasMore = false;
  error: string | null = null;
  revoking = new Set<string>();

  oninit(vnode: Mithril.Vnode<BadgeGrantsModalAttrs, this>) {
    super.oninit(vnode);

    this.load(0);
  }

  className() {
    return 'CanelaBadgeGrantsModal Modal--medium';
  }

  title() {
    return trans(`${KEY}.grants_title`, 'Concessões de "{badge}"', { badge: this.attrs.badge.attributes.name });
  }

  load(offset: number): void {
    this.loadingRows = true;

    loadGrants(this.attrs.badge.id, offset)
      .then(({ rows, hasMore }) => {
        this.rows.push(...rows);
        this.hasMore = hasMore;
      })
      .catch((error) => (this.error = errorText(error)))
      .finally(() => {
        this.loadingRows = false;
        m.redraw();
      });
  }

  content() {
    return (
      <div className="Modal-body">
        {this.error && <p className="CanelaAdmin-formError">{this.error}</p>}
        {!this.rows.length && this.loadingRows && <LoadingIndicator display="block" />}
        {!this.rows.length && !this.loadingRows && <p className="helpText">{trans(`${KEY}.grants_none`, 'Ninguém tem este emblema.')}</p>}
        {!!this.rows.length && (
          <table className="CanelaAdmin-badgesTable CanelaAdmin-grantsTable">
            <tbody>{this.rows.map((row) => this.row(row))}</tbody>
          </table>
        )}
        {this.hasMore && (
          <Button className="Button" loading={this.loadingRows} onclick={() => this.load(this.rows.length)}>
            {trans(`${KEY}.load_more`, 'Carregar mais')}
          </Button>
        )}
      </div>
    );
  }

  row(row: GrantRow) {
    const date = row.grantedAt ? new Date(row.grantedAt) : null;

    return (
      <tr key={row.id}>
        <td>
          <strong>{row.user?.displayName ?? '-'}</strong>
          {row.user && <span className="CanelaAdmin-badgeDescription"> @{row.user.username}</span>}
          {row.reason && <span className="CanelaAdmin-badgeDescription CanelaAdmin-grantReason">{row.reason}</span>}
        </td>
        <td className="CanelaAdmin-badgeCount">{date ? date.toLocaleDateString() : ''}</td>
        <td>
          <Button className="Button Button--link CanelaAdmin-danger" loading={this.revoking.has(row.id)} onclick={() => this.revoke(row)}>
            {trans(`${KEY}.revoke`, 'Revogar')}
          </Button>
        </td>
      </tr>
    );
  }

  revoke(row: GrantRow): void {
    const name = row.user?.displayName ?? '';

    if (!confirm(trans(`${KEY}.revoke_confirm`, 'Revogar o emblema de {username}?', { username: name }))) return;

    this.revoking.add(row.id);

    revokeGrant(row.id)
      .then(() => {
        this.rows = this.rows.filter((item) => item !== row);
        this.attrs.onchange();
      })
      .catch((error) => (this.error = errorText(error)))
      .finally(() => {
        this.revoking.delete(row.id);
        m.redraw();
      });
  }
}

export function openGrantsModal(badge: BadgeRow, onchange: () => void): void {
  app.modal.show(BadgeGrantsModal, { badge, onchange });
}
