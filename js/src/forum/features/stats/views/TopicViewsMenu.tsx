/*
 * O conteúdo do menu "Visualizações recentes" do mapa do tópico: busca os
 * dias ao abrir (com o carregando do Discourse) e escolhe entre o gráfico,
 * com mais de dois dias, e os números lado a lado.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import TopicViews from './TopicViews';
import { once } from '../../../utils/chunkGate';
import { cachedViewStats, fetchViewStats, type ViewStatsResponse } from './viewStats';

export interface TopicViewsMenuAttrs extends ComponentAttrs {
  discussion: Discussion;
  /** O total do tópico, para o dia de hoje quando ainda não há dias gravados. */
  views: number;
}

// O gráfico é um chunk: pedido junto com os números, então chega com eles.
const loadChart = once(() => import('./TopicViewsChart').then((mod) => mod.default));
let TopicViewsChart: any = null;
let chartFailed = false;

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

  view() {
    const chartPending = !TopicViewsChart && !chartFailed && !!this.data && this.data.stats.length > 2;

    if (this.loading || chartPending) return <LoadingIndicator size="small" display="block" />;

    if (this.failed || !this.data) return <div className="CanelaViewsChart CanelaViewsChart--error">{t('stats.views.chart_error')}</div>;

    // `shouldShowViewsChart`: o gráfico só a partir de três dias com dados.
    return this.data.stats.length > 2 && TopicViewsChart ? <TopicViewsChart stats={this.data.stats} /> : <TopicViews stats={this.data.stats} />;
  }
}
