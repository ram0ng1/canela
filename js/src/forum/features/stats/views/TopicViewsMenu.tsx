/*
 * O conteúdo do menu "Visualizações recentes" do mapa do tópico: busca os
 * dias ao abrir (com um indicador de carregamento) e escolhe entre o gráfico,
 * com mais de dois dias, e os números lado a lado.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import TopicViews from './TopicViews';
import { once } from '../../../utils/chunkGate';
import { cachedViewStats, fetchViewStats, fullWindow, type ViewStat, type ViewStatsResponse } from './viewStats';

export interface TopicViewsMenuAttrs extends ComponentAttrs {
  discussion: Discussion;
  /** O total do tópico, para o dia de hoje quando ainda não há dias gravados. */
  views: number;
}

// O gráfico é um chunk: pedido junto com os números, então chega com eles.
const loadChart = once(() => import('./TopicViewsChart').then((mod) => mod.default));
let TopicViewsChart: any = null;
let chartFailed = false;

/**
 * Busca os números (e o gráfico) antes do clique, ao passar o mouse ou focar
 * "visualizações": o menu abre já com o conteúdo, sem o carregando que o fazia
 * mudar de tamanho na frente da pessoa.
 */
export function prefetchTopicViews(discussion: Discussion, views: number): void {
  if (!TopicViewsChart && !chartFailed) {
    loadChart()
      .then((chart) => (TopicViewsChart = chart))
      .catch(() => (chartFailed = true));
  }

  if (!cachedViewStats(discussion)) fetchViewStats(discussion, views).catch(() => {});
}

export default class TopicViewsMenu extends Component<TopicViewsMenuAttrs> {
  data?: ViewStatsResponse;
  loading = true;
  failed = false;

  oninit(vnode: Mithril.Vnode<TopicViewsMenuAttrs, this>) {
    super.oninit(vnode);

    this.data = cachedViewStats(this.attrs.discussion);
    this.loading = !this.data;

    if (!TopicViewsChart) {
      loadChart()
        .then((chart) => (TopicViewsChart = chart))
        .catch(() => (chartFailed = true))
        .finally(() => m.redraw());
    }

    if (!this.data) {
      fetchViewStats(this.attrs.discussion, this.attrs.views)
        .then((data) => {
          this.data = data;
        })
        .catch(() => {
          // O app.request já mostrou o alerta de erro, como o dialog.alert de lá.
          this.failed = true;
        })
        .finally(() => {
          this.loading = false;
          m.redraw();
        });
    }
  }

  /**
   * Os dias do menu. Com dias gravados, a janela inteira (30 dias, ou desde a
   * criação do tópico) com zero nos dias sem registro; sem nenhum, o total
   * em hoje.
   */
  stats(): ViewStat[] {
    if (!this.data) return [];
    if (this.data.estimated) return this.data.stats;

    return fullWindow(this.data.stats, this.attrs.discussion.createdAt());
  }

  view() {
    const stats = this.stats();
    const chartPending = !TopicViewsChart && !chartFailed && stats.length > 2;

    if (this.loading || chartPending) return <LoadingIndicator size="small" display="block" />;

    if (this.failed || !this.data) return <div className="CanelaViewsChart CanelaViewsChart--error">{t('stats.views.chart_error')}</div>;

    // `shouldShowViewsChart`: o gráfico só a partir de três dias.
    return stats.length > 2 && TopicViewsChart ? <TopicViewsChart stats={stats} /> : <TopicViews stats={stats} />;
  }
}
