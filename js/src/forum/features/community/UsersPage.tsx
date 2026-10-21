import app from 'flarum/forum/app';
import type Mithril from 'mithril';

import CommunityPage from './CommunityPage';
import DirectoryState from './DirectoryState';
import DirectoryTable from './DirectoryTable';
import DirectoryControls from './DirectoryControls';
import { PERIODS, type PeriodKey } from './api';
import { forumBool, t } from '../../utils/settings';

/**
 * O diretório de usuários (/u): quem participa e quanto, no
 * período escolhido.
 *
 * Os filtros ficam na URL (?period=weekly&order=postCount…),
 * para dar para compartilhar a tabela. A URL é trocada com
 * `replaceState`, e não pelo roteador: mudar a rota recriaria a página e
 * jogaria fora as linhas já carregadas.
 */
export default class UsersPage extends CommunityPage {
  directory!: DirectoryState;
  private lastQuery = '';

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    const period = m.route.param('period') as PeriodKey;

    this.directory = new DirectoryState({
      period: PERIODS.includes(period) ? period : 'all',
      order: m.route.param('order') || undefined,
      dir: m.route.param('dir') === 'asc' ? 'asc' : undefined,
      q: m.route.param('q') || undefined,
    });

    if (this.enabled()) this.directory.refresh();
  }

  onupdate(vnode: Mithril.VnodeDOM<any, this>) {
    super.onupdate(vnode);
    this.syncUrl();
  }

  title(): string {
    return t('community.users.title');
  }

  className(): string {
    return 'CanelaUsersPage';
  }

  enabled(): boolean {
    return forumBool('canelaDirectoryEnabled', true) && forumBool('canelaCanViewDirectory', false);
  }

  unavailableText(): string {
    if (!forumBool('canelaDirectoryEnabled', true)) return super.unavailableText();

    return app.session.user ? t('community.users.forbidden') : t('community.users.login_required');
  }

  content(): Mithril.Children {
    return (
      <div className="CanelaUsers">
        {/* Sem título visível aqui: o período faz esse papel. */}
        <h1 className="sr-only">{t('community.users.title')}</h1>
        <DirectoryControls state={this.directory} />
        <DirectoryTable state={this.directory} emptyText={t('community.users.empty')} />
      </div>
    );
  }

  private syncUrl(): void {
    const { period, order, dir, q } = this.directory.params;
    const params: Record<string, string> = {};

    if (period && period !== 'all') params.period = period;
    if (order) params.order = order;
    if (dir === 'asc') params.dir = dir;
    if (q) params.q = q;

    const query = m.buildQueryString(params);

    if (query === this.lastQuery) return;

    this.lastQuery = query;

    const url = app.route('canela.users') + (query ? `?${query}` : '');

    window.history.replaceState(window.history.state, '', url);
  }
}
