import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import formatNumber from 'flarum/common/utils/formatNumber';
import type Mithril from 'mithril';

import UserTile from './UserTile';
import type DirectoryState from './DirectoryState';
import type { LoadedRow } from './DirectoryState';
import { t } from '../../utils/settings';
import { shortAge } from '../../utils/dates';

/** Ícone de cada coluna, como os do cabeçalho do diretório do Discourse. */
const COLUMN_ICONS: Record<string, string> = {
  likesReceived: 'fas fa-heart',
  likesGiven: 'fas fa-heart',
};

/** Colunas numéricas que vêm na linha (as outras saem do modelo do usuário). */
const NUMERIC = ['likesReceived', 'likesGiven', 'topicCount', 'postCount', 'daysVisited', 'postsRead'];

export interface DirectoryTableAttrs extends ComponentAttrs {
  state: DirectoryState;
  /** Texto quando não há ninguém (sem busca). */
  emptyText: string;
}

/**
 * A tabela do diretório do Discourse: usuário à esquerda, uma coluna por
 * número, cabeçalhos clicáveis para ordenar e "carregar mais" no fim.
 *
 * "Último acesso" sempre aparece (quando o usuário o divulga), mas só ordena
 * para quem tem a permissão do core — o servidor diz quais colunas ordenam.
 */
export default class DirectoryTable extends Component<DirectoryTableAttrs> {
  view(): Mithril.Children {
    const { state, emptyText } = this.attrs;
    const columns = this.displayColumns();

    if (state.failed && !state.rows.length) {
      return <p className="CanelaCommunity-empty">{t('community.load_error')}</p>;
    }

    if (!state.loading && !state.rows.length && state.total !== null) {
      return <p className="CanelaCommunity-empty">{state.params.q ? t('community.users.no_results') : emptyText}</p>;
    }

    return (
      <div className="CanelaDirectory">
        <div className="CanelaCommunity-tableWrap">
          <table className="CanelaCommunity-table CanelaDirectory-table">
            <thead>
              <tr>
                {this.header('username', t('community.users.column.username'), 'CanelaDirectory-userCol')}
                {columns.map((column) => this.header(column, t(`community.users.column.${column}`), 'CanelaCommunity-num'))}
              </tr>
            </thead>
            <tbody>{state.rows.map((row) => this.row(row, columns))}</tbody>
          </table>
        </div>

        {state.loading && <LoadingIndicator display="block" />}

        {!state.loading && state.hasMore && (
          <div className="CanelaCommunity-more">
            <Button className="Button" onclick={() => state.loadMore()}>
              {t('community.load_more')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  /** As colunas do servidor, mais "Último acesso" quando ele não ordena por ela. */
  displayColumns(): string[] {
    const columns = [...this.attrs.state.columns];

    if (!columns.includes('lastSeenAt')) columns.push('lastSeenAt');

    return columns;
  }

  header(column: string, label: string, className: string): Mithril.Children {
    const { state } = this.attrs;
    const sortable = column === 'username' || state.columns.includes(column);
    const active = state.currentOrder() === column;
    const icon = COLUMN_ICONS[column];
    const content = (
      <>
        {icon && <Icon name={icon} className="CanelaDirectory-columnIcon" />}
        <span>{label}</span>
        {active && <Icon name={state.params.dir === 'asc' ? 'fas fa-chevron-up' : 'fas fa-chevron-down'} className="CanelaDirectory-sortIcon" />}
      </>
    );

    return (
      <th
        className={classList(className, `CanelaDirectory-col--${column}`, { 'is-sorted': active })}
        aria-sort={active ? (state.params.dir === 'asc' ? 'ascending' : 'descending') : undefined}
        scope="col"
      >
        {sortable ? (
          <button type="button" className="CanelaDirectory-sort" onclick={() => state.sortBy(column)}>
            {content}
          </button>
        ) : (
          <span className="CanelaDirectory-sort is-static">{content}</span>
        )}
      </th>
    );
  }

  row(row: LoadedRow, columns: string[]): Mithril.Children {
    const user = row.model;
    const isMe = app.session.user === user;

    return (
      <tr key={row.user} className={classList({ 'is-me': isMe })}>
        <td className="CanelaDirectory-userCol">
          <UserTile user={user} size="small" />
        </td>
        {columns.map((column) => (
          <td
            className={`CanelaCommunity-num CanelaDirectory-value CanelaDirectory-col--${column}`}
            data-label={t(`community.users.column.${column}`)}
          >
            {this.value(row, column)}
          </td>
        ))}
      </tr>
    );
  }

  value(row: LoadedRow, column: string): Mithril.Children {
    if (NUMERIC.includes(column)) {
      const value = (row as any)[column];

      return typeof value === 'number' ? formatNumber(value) : '-';
    }

    if (column === 'lastSeenAt') {
      const seen = row.model.lastSeenAt();

      return seen ? (
        <time datetime={seen.toISOString()} title={seen.toLocaleString()}>
          {shortAge(seen)}
        </time>
      ) : (
        '-'
      );
    }

    return null;
  }
}
