import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

import { AdminComponent, trans } from '../../util';
import { AdminNotice } from '../../components/AdminCard';
import { medal } from './medal';
import { openBadgeEditor } from './BadgeEditModal';
import { openGrantModal } from './GrantBadgeModal';
import { openGrantsModal } from './BadgeGrantsModal';
import { KEY, deleteBadge, errorText, hasAdminColumns, loadBadges, restoreSystemBadges, saveBadge, type BadgeRow } from './api';

/**
 * O admin de emblemas, como o /admin/badges do Discourse: todos os emblemas
 * (do sistema e personalizados) com medalha, tipo, concessões e o
 * liga/desliga; e as ações de criar, editar, conceder, ver concessões,
 * remover e restaurar os do sistema.
 */
export default class BadgeManager extends AdminComponent {
  rows: BadgeRow[] | null = null;
  error: string | null = null;
  notice: string | null = null;
  busy = new Set<string>();
  restoring = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    this.reload();
  }

  reload(): void {
    loadBadges()
      .then((rows) => {
        this.rows = rows;
        this.error = null;
      })
      .catch(() => (this.error = trans(`${KEY}.table_failed`, 'Não deu para carregar os emblemas. As migrações do tema já rodaram?')))
      .finally(() => m.redraw());
  }

  grantable(): BadgeRow[] {
    return (this.rows || []).filter((row) => row.attributes.canGrant);
  }

  adminColumns(): boolean {
    return hasAdminColumns(this.rows?.[0]);
  }

  view() {
    if (this.error && !this.rows) return <AdminNotice icon="fas fa-triangle-exclamation">{this.error}</AdminNotice>;

    if (!this.rows) return <LoadingIndicator display="block" />;

    const reload = () => this.reload();

    return (
      <div className="CanelaBadgeManager">
        <div className="CanelaBadgeManager-toolbar">
          <Button className="Button Button--primary" icon="fas fa-plus" onclick={() => openBadgeEditor(null, this.adminColumns(), reload)}>
            {trans(`${KEY}.new_badge`, 'Novo emblema')}
          </Button>
          <Button className="Button" icon="fas fa-award" onclick={() => openGrantModal(this.grantable(), undefined, reload)}>
            {trans(`${KEY}.grant_badge`, 'Conceder emblema')}
          </Button>
          <Button className="Button" icon="fas fa-rotate-left" loading={this.restoring} onclick={() => this.restore()}>
            {trans(`${KEY}.restore_system`, 'Restaurar emblemas do sistema')}
          </Button>
        </div>

        {!this.adminColumns() && (
          <AdminNotice icon="fas fa-database">
            {trans(
              `${KEY}.needs_migration`,
              'Imagem, "pode ser título", concessão manual opcional e o motivo da concessão aparecem depois de rodar php flarum migrate.'
            )}
          </AdminNotice>
        )}
        {this.notice && <p className="CanelaAdmin-formDone">{this.notice}</p>}
        {this.error && <p className="CanelaAdmin-formError">{this.error}</p>}

        <table className="CanelaAdmin-badgesTable">
          <thead>
            <tr>
              <th>{trans(`${KEY}.col_badge`, 'Emblema')}</th>
              <th>{trans(`${KEY}.col_type`, 'Tipo')}</th>
              <th>{trans(`${KEY}.col_granted`, 'Concedidos')}</th>
              <th>{trans(`${KEY}.col_enabled`, 'Ligado')}</th>
              <th />
            </tr>
          </thead>
          <tbody>{this.rows.map((row) => this.row(row))}</tbody>
        </table>
      </div>
    );
  }

  row(row: BadgeRow) {
    const a = row.attributes;
    const reload = () => this.reload();

    return (
      <tr key={row.id} className={a.available === false || !a.enabled ? 'is-unavailable' : ''}>
        <td>
          <div className="CanelaAdmin-badgeCell">
            {medal(a)}
            <span>
              <strong>{a.name}</strong>
              {a.description && <span className="CanelaAdmin-badgeDescription">{a.description}</span>}
              <span className="CanelaAdmin-badgeTags">
                <span className={`CanelaAdmin-badgeTag${a.system ? ' CanelaAdmin-badgeTag--system' : ''}`}>
                  {a.system ? trans(`${KEY}.tag_system`, 'Sistema') : trans(`${KEY}.tag_custom`, 'Personalizado')}
                </span>
                {!a.listable && <span className="CanelaAdmin-badgeTag">{trans(`${KEY}.tag_unlisted`, 'Fora da página')}</span>}
                {a.canGrant && <span className="CanelaAdmin-badgeTag">{trans(`${KEY}.tag_manual`, 'Manual')}</span>}
              </span>
              {a.available === false && (
                <span className="CanelaAdmin-badgeUnavailable">
                  {trans(`${KEY}.unavailable`, 'Este fórum não tem o que a regra mede (extensão desligada ou recurso do tema ausente).')}
                </span>
              )}
            </span>
          </div>
        </td>
        <td className="CanelaAdmin-badgeType">{trans(`${KEY}.type_${a.type}`, a.type)}</td>
        <td className="CanelaAdmin-badgeCount">
          <Button className="Button Button--link" onclick={() => openGrantsModal(row, reload)} title={trans(`${KEY}.view_grants`, 'Ver concessões')}>
            {a.grantCount}
          </Button>
        </td>
        <td>
          <Switch state={a.enabled} disabled={this.busy.has(row.id)} onchange={(checked: boolean) => this.toggle(row, checked)} />
        </td>
        <td className="CanelaAdmin-badgeActions">
          <Button
            className="Button Button--icon Button--flat"
            icon="fas fa-pen"
            aria-label={trans(`${KEY}.edit`, 'Editar')}
            title={trans(`${KEY}.edit`, 'Editar')}
            onclick={() => openBadgeEditor(row, this.adminColumns(), reload)}
          />
          {a.canGrant && (
            <Button
              className="Button Button--icon Button--flat"
              icon="fas fa-award"
              aria-label={trans(`${KEY}.grant_badge`, 'Conceder emblema')}
              title={trans(`${KEY}.grant_badge`, 'Conceder emblema')}
              onclick={() => openGrantModal(this.grantable(), row.id, reload)}
            />
          )}
          <Button
            className="Button Button--icon Button--flat CanelaAdmin-danger"
            icon="far fa-trash-can"
            loading={this.busy.has(row.id)}
            aria-label={trans(`${KEY}.remove`, 'Remover')}
            title={trans(`${KEY}.remove`, 'Remover')}
            onclick={() => this.remove(row)}
          />
        </td>
      </tr>
    );
  }

  toggle(row: BadgeRow, enabled: boolean): void {
    row.attributes.enabled = enabled;
    this.busy.add(row.id);

    saveBadge(row.id, { enabled })
      .catch((error) => {
        row.attributes.enabled = !enabled;
        this.error = errorText(error);
      })
      .finally(() => {
        this.busy.delete(row.id);
        m.redraw();
      });
  }

  remove(row: BadgeRow): void {
    const a = row.attributes;
    const message = a.system
      ? trans(
          `${KEY}.remove_system_confirm`,
          'Remover o emblema do sistema "{badge}"? As {count} concessões são apagadas. Ele só volta com "Restaurar emblemas do sistema" (sem as concessões antigas, que a regra refaz na próxima carga).',
          { badge: a.name, count: a.grantCount }
        )
      : trans(`${KEY}.remove_custom_confirm`, 'Apagar o emblema "{badge}" e as {count} concessões dele? Não dá para desfazer.', {
          badge: a.name,
          count: a.grantCount,
        });

    if (!confirm(message)) return;

    this.busy.add(row.id);

    deleteBadge(row.id)
      .then(() => {
        this.rows = (this.rows || []).filter((item) => item !== row);
        this.notice = trans(`${KEY}.removed`, 'Emblema removido.');
      })
      .catch((error) => (this.error = errorText(error)))
      .finally(() => {
        this.busy.delete(row.id);
        m.redraw();
      });
  }

  restore(): void {
    if (
      !confirm(
        trans(`${KEY}.restore_confirm`, 'Recriar os emblemas do sistema que foram removidos? Os que existem (editados ou não) ficam como estão.')
      )
    )
      return;

    this.restoring = true;

    restoreSystemBadges()
      .then((count) => {
        this.notice = trans(
          `${KEY}.restored`,
          '{count, plural, =0 {Nenhum emblema do sistema faltava.} one {# emblema do sistema restaurado.} other {# emblemas do sistema restaurados.}}',
          { count }
        );
        this.reload();
      })
      .catch((error) => (this.error = errorText(error)))
      .finally(() => {
        this.restoring = false;
        m.redraw();
      });
  }
}
