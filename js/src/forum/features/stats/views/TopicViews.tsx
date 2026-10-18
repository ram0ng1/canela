/*
 * Com até dois dias de dados o Discourse não desenha o gráfico: mostra os
 * números de cada dia lado a lado (topic-views), com a data embaixo. O dia de
 * hoje nunca mostra zero — alguém está vendo o tópico agora.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';

import { t } from '../../../utils/settings';
import type { ViewStat } from './viewStats';

export interface TopicViewsAttrs extends ComponentAttrs {
  stats: ViewStat[];
}

/**
 * O `adjustAggregatedData` do Discourse: soma os dias UTC que caem na mesma
 * data local (só acontece em fusos muito distantes de UTC).
 */
function aggregate(stats: ViewStat[]): { date: Date; views: number }[] {
  const days: { key: string; date: Date; views: number }[] = [];

  stats.forEach((stat) => {
    const utc = new Date(`${stat.viewed_at}T00:00:00Z`);
    const key = utc.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const existing = days.find((day) => day.key === key);

    if (existing) existing.views += stat.views;
    else days.push({ key, date: new Date(`${utc.toISOString().split('T')[0]}T00:00:00`), views: stat.views });
  });

  return days.map(({ date, views }) => ({ date, views }));
}

export default class TopicViews extends Component<TopicViewsAttrs> {
  view() {
    const days = aggregate(this.attrs.stats || []);

    if (!days.length) return <div className="CanelaTopicViews CanelaTopicViews--empty">{t('stats.views.no_views')}</div>;

    days[days.length - 1].views = Math.max(days[days.length - 1].views, 1);

    const lang = document.documentElement.lang || undefined;

    return (
      <div className="CanelaTopicViews topic-views__wrapper">
        {days.map((day) => (
          <div className="CanelaTopicViews-day topic-views">
            <div className="CanelaTopicViews-count topic-views__count">{day.views}</div>
            <div className="CanelaTopicViews-date topic-views__date">{day.date.toLocaleDateString(lang, { month: '2-digit', day: '2-digit' })}</div>
          </div>
        ))}
      </div>
    );
  }
}
