/*
 * "Melhores" por período: na aba Melhores, um seletor
 * (Todo o período / Ano / Trimestre / Mês / Semana / Hoje) limita a lista aos
 * tópicos criados no intervalo.
 *
 * O período vai na URL (`?sort=top&period=monthly`), entra nos parâmetros
 * "grudentos" da busca e chega ao DiscussionListState, que o traduz no filtro
 * `created` do core (`AAAA-MM-DD..AAAA-MM-DD`). Assim recarregar, voltar e
 * compartilhar o link mantêm o período.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import SelectDropdown from 'flarum/common/components/SelectDropdown';
import LinkButton from 'flarum/common/components/LinkButton';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import GlobalSearchState from 'flarum/forum/states/GlobalSearchState';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool, t } from '../../utils/settings';
import { lastDaysRange } from '../../utils/dates';

const TOP_SORT = 'top';

/** Período => dias para trás. `all` não filtra. */
export const TOP_PERIODS: Record<string, number> = {
  all: 0,
  yearly: 365,
  quarterly: 90,
  monthly: 30,
  weekly: 7,
  daily: 1,
};

function enabled(): boolean {
  return forumBool('canelaTopPeriodsEnabled', true);
}

function validPeriod(value: unknown): string | null {
  return typeof value === 'string' && value in TOP_PERIODS && value !== 'all' ? value : null;
}

/** A ordenação ativa da página: a da URL ou, sem ela, a padrão. */
function currentSort(): string {
  return app.search.state.params().sort || app.search.state.defaultSort();
}

export default function installTopPeriods(): void {
  extend(GlobalSearchState.prototype, 'stickyParams', function (params: Record<string, any>) {
    if (!enabled()) return;

    const period = validPeriod(m.route.param('period'));

    // Só acompanha a lista enquanto ela é a de Melhores: trocar de aba não
    // pode levar um filtro de data invisível para "Recentes".
    if (period && (m.route.param('sort') || app.search.state.defaultSort()) === TOP_SORT) params.period = period;
  });

  extend(DiscussionListState.prototype, 'requestParams', function (this: DiscussionListState, params: Record<string, any>) {
    if (!enabled()) return;

    const own = this.getParams() as Record<string, any>;
    const period = validPeriod(own.period);
    const sort = own.sort || Object.keys(this.sortMap())[0];

    if (!period || sort !== TOP_SORT) return;

    params.filter = { ...params.filter, created: lastDaysRange(TOP_PERIODS[period]) };
  });

  extend(IndexPage.prototype, 'viewItems', function (items: ItemList<Mithril.Children>) {
    if (!enabled() || currentSort() !== TOP_SORT || !(TOP_SORT in app.discussions.sortMap())) return;

    const active = validPeriod(m.route.param('period')) || 'all';
    const routeName = app.current.get('routeName') || 'index';
    const base: Record<string, any> = { ...app.search.state.params() };

    // Parâmetros vazios só sujariam a URL ("?q=&filter=").
    Object.keys(base).forEach((key) => {
      const value = base[key];
      if (value === undefined || value === '' || (typeof value === 'object' && value && !Object.keys(value).length)) delete base[key];
    });

    items.add(
      'canelaTopPeriod',
      <SelectDropdown
        className="CanelaTopPeriod"
        buttonClassName="Button CanelaTopPeriod-button"
        caretIcon="fas fa-chevron-down"
        accessibleToggleLabel={t('extras.top_periods.label')}
      >
        {Object.keys(TOP_PERIODS).map((period) => {
          const params = { ...base };

          if (period === 'all') delete params.period;
          else params.period = period;

          return (
            <LinkButton href={app.route(routeName, params)} active={period === active} icon={period === active ? 'fas fa-check' : true}>
              {t(`extras.top_periods.${period}`)}
            </LinkButton>
          );
        })}
      </SelectDropdown>,
      // Logo depois da ordenação do core (100), que o tema esconde.
      90
    );
  });
}
