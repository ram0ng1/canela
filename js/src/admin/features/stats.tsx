/*
 * Cards das estatísticas: visualizações de tópico (lista), as contagens de
 * Novos/Não lidos (lista) e a atividade do resumo do perfil.
 */
import { trans } from '../util';
import { AdminNotice, AdminSubGroup, SubDivider, SubTitle } from '../components/AdminCard';
import AdminNumber from '../components/AdminNumber';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.stats';

const number = (name: string, range: { min: number; max: number; fallback: number }, suffix?: string) => (
  <AdminNumber
    settingKey={`canela.${name}`}
    min={range.min}
    max={range.max}
    fallback={range.fallback}
    suffix={suffix}
    label={trans(`${KEY}.${name}_label`)}
    help={trans(`${KEY}.${name}_help`, { min: range.min, max: range.max })}
  />
);

const help = (name: string) => () => trans(`${KEY}.${name}_help`);

const STATS_CARDS: CardDef[] = [
  {
    id: 'views',
    group: 'list',
    icon: 'far fa-eye',
    title: () => trans(`${KEY}.section_views`),
    description: help('stats_views_enabled'),
    keywords:
      'visualizações views contador counter estatísticas stats horas hours janela window visitantes guests robôs bots calor heat heatmap realce highlight gráfico chart topic_view_duration_hours topic_views_heat',
    master: 'canela.stats_views_enabled',
    body: () => (
      <>
        {number('stats_view_window_hours', { min: 1, max: 720, fallback: 8 }, trans(`${KEY}.hours_suffix`))}
        <AdminNotice>{trans(`${KEY}.views_notice`)}</AdminNotice>
        <SubDivider />
        {/* As faixas do heatmap (topic_views_heat_low/medium/high). */}
        <SubTitle>{trans(`${KEY}.heat_title`)}</SubTitle>
        <p className="helpText">{trans(`${KEY}.heat_help`)}</p>
        <AdminSubGroup>
          {number('topic_views_heat_low', { min: 1, max: 100000000, fallback: 1000 }, trans(`${KEY}.views_suffix`))}
          {number('topic_views_heat_medium', { min: 1, max: 100000000, fallback: 2000 }, trans(`${KEY}.views_suffix`))}
          {number('topic_views_heat_high', { min: 1, max: 100000000, fallback: 3500 }, trans(`${KEY}.views_suffix`))}
        </AdminSubGroup>
      </>
    ),
  },
  {
    id: 'counts',
    group: 'list',
    icon: 'fas fa-circle-dot',
    title: () => trans(`${KEY}.section_counts`),
    description: help('stats_counts_enabled'),
    keywords: 'novos new não lidos unread contagem count abas tabs ponto dot barra lateral sidebar tópicos topics',
    master: 'canela.stats_counts_enabled',
    body: () => number('stats_new_days', { min: 0, max: 365, fallback: 2 }, trans(`${KEY}.days_suffix`)),
  },
  {
    id: 'link-clicks',
    group: 'topic',
    icon: 'fas fa-link',
    title: () => trans(`${KEY}.section_links`),
    description: help('stats_links_enabled'),
    keywords: 'links cliques clicks contagem count links populares popular links melhores links top links topic_link_clicks mapa do tópico topic map',
    master: 'canela.stats_links_enabled',
    body: () => <AdminNotice>{trans(`${KEY}.links_notice`)}</AdminNotice>,
  },
  {
    id: 'activity',
    group: 'people',
    icon: 'fas fa-chart-simple',
    title: () => trans(`${KEY}.section_activity`),
    description: help('stats_activity_enabled'),
    keywords: 'atividade activity resumo summary dias visitados days visited tempo de leitura read time postagens lidas posts read curtidas likes',
    master: 'canela.stats_activity_enabled',
    body: () => <AdminNotice>{trans(`${KEY}.activity_notice`)}</AdminNotice>,
  },
];

export default STATS_CARDS;
