/*
 * Cards dos emblemas e dos níveis de confiança: as chaves gerais, os
 * requisitos de cada nível e o admin de emblemas (criar, editar, ligar,
 * conceder, remover e restaurar — ./badgesAdmin).
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';

import { AdminComponent, trans, getBool } from '../util';
import { AdminNotice, AdminSubGroup, SubTitle } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminNumber from '../components/AdminNumber';
import type { CardDef } from '../types';
import BadgeManager from './badgesAdmin/BadgeManager';

const KEY = 'ramon-canela.admin.settings.badges';

const apiUrl = () => ((app.forum.attribute<string>('apiUrl') as string) || '/api').replace(/\/+$/, '');

const toggle = (name: string, dependsOn?: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} dependsOn={dependsOn} />
);

const requirement = (name: string, fallback: number, suffix?: string, max = 100000) => (
  <AdminNumber
    settingKey={`canela.${name}`}
    label={trans(`${KEY}.${name}_label`)}
    min={0}
    max={max}
    fallback={fallback}
    suffix={suffix ? trans(`${KEY}.unit_${suffix}`) : undefined}
  />
);

/** O que este fórum consegue medir (o servidor responde só ao admin). */
const capabilities = (): Record<string, boolean> => (app.forum.attribute<Record<string, boolean>>('canelaBadgesCapabilities') as any) || {};

// ─────────────────────────────────────────────────────────────────────────────
// "Conceder agora"
// ─────────────────────────────────────────────────────────────────────────────

class RecalculateButton extends AdminComponent {
  loading = false;
  done = false;

  view() {
    return (
      <div className="Form-group CanelaAdmin-badgesRun">
        <Button
          className="Button"
          icon="fas fa-certificate"
          loading={this.loading}
          disabled={!getBool('canela.badges_enabled')}
          onclick={() => this.run()}
        >
          {trans(`${KEY}.run_now`)}
        </Button>
        {this.done && <span className="CanelaAdmin-badgesRunDone">{trans(`${KEY}.run_queued`)}</span>}
        <p className="helpText">{trans(`${KEY}.run_help`)}</p>
      </div>
    );
  }

  run(): void {
    this.loading = true;
    this.done = false;

    app
      .request({ method: 'POST', url: `${apiUrl()}/canela-badges/recalculate` })
      .then(() => (this.done = true))
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────────────────────────────────────

const BADGE_CARDS: CardDef[] = [
  {
    id: 'badges',
    group: 'community',
    icon: 'fas fa-certificate',
    title: () => trans(`${KEY}.badges_enabled_label`),
    description: () => trans(`${KEY}.badges_enabled_help`),
    keywords: 'emblemas badges conquistas medalhas curtidas likes conceder grant',
    master: 'canela.badges_enabled',
    body: () => (
      <>
        {toggle('badges_user_card', 'canela.user_card')}
        {toggle('badges_summary', 'canela.user_summary')}
        <AdminNumber
          settingKey="canela.badges_max_likes_per_day"
          label={trans(`${KEY}.badges_max_likes_per_day_label`)}
          help={trans(`${KEY}.badges_max_likes_per_day_help`)}
          min={1}
          max={1000}
          fallback={50}
        />
        <RecalculateButton />
      </>
    ),
  },
  {
    id: 'badge-manager',
    group: 'community',
    icon: 'fas fa-medal',
    title: () => trans(`${KEY}.section_manager`),
    description: () => trans(`${KEY}.table_help`),
    keywords: 'emblemas badges lista tabela ligar desligar criar novo remover restaurar conceder revogar personalizado',
    dependsOn: 'canela.badges_enabled',
    body: () => <BadgeManager />,
  },
  {
    id: 'trust-levels',
    group: 'community',
    icon: 'fas fa-shield-halved',
    title: () => trans(`${KEY}.trust_levels_enabled_label`),
    description: () => trans(`${KEY}.trust_levels_enabled_help`),
    keywords: 'níveis confiança trust levels requisitos promoção básico membro regular líder',
    master: 'canela.trust_levels_enabled',
    body: () => {
      const caps = capabilities();
      const measured = caps.visits && caps.topicViews;

      return (
        <>
          <AdminNotice icon={measured ? 'fas fa-chart-line' : 'fas fa-circle-info'}>
            {measured ? trans(`${KEY}.source_stats`) : trans(`${KEY}.source_core`)}
            {!caps.likes && ' ' + trans(`${KEY}.no_likes`)}
          </AdminNotice>

          <SubTitle>{trans(`${KEY}.level_1`)}</SubTitle>
          <AdminSubGroup>
            {requirement('tl1_requires_topics_entered', 5)}
            {requirement('tl1_requires_read_posts', 30)}
            {requirement('tl1_requires_time_spent_mins', 10, 'minutes')}
          </AdminSubGroup>

          <SubTitle>{trans(`${KEY}.level_2`)}</SubTitle>
          <AdminSubGroup>
            {requirement('tl2_requires_topics_entered', 20)}
            {requirement('tl2_requires_read_posts', 100)}
            {requirement('tl2_requires_time_spent_mins', 60, 'minutes')}
            {requirement('tl2_requires_days_visited', 15, 'days')}
            {requirement('tl2_requires_likes_received', 1)}
            {requirement('tl2_requires_likes_given', 1)}
            {requirement('tl2_requires_topic_reply_count', 3)}
          </AdminSubGroup>

          <SubTitle>{trans(`${KEY}.level_3`)}</SubTitle>
          <AdminSubGroup>
            {requirement('tl3_time_period', 100, 'days', 1000)}
            {requirement('tl3_requires_days_visited', 50, 'days')}
            {requirement('tl3_requires_topics_replied_to', 10)}
            {requirement('tl3_requires_topics_viewed', 25, 'percent', 100)}
            {requirement('tl3_requires_topics_viewed_cap', 250)}
            {requirement('tl3_requires_posts_read', 25, 'percent', 100)}
            {requirement('tl3_requires_posts_read_cap', 2000)}
            {requirement('tl3_requires_topics_viewed_all_time', 200)}
            {requirement('tl3_requires_posts_read_all_time', 500)}
            {requirement('tl3_requires_max_flagged', 5)}
            {requirement('tl3_requires_likes_given', 30)}
            {requirement('tl3_requires_likes_received', 20)}
            {requirement('tl3_promotion_min_duration', 100, 'days', 10000)}
          </AdminSubGroup>

          <SubTitle>{trans(`${KEY}.level_4`)}</SubTitle>
          <p className="helpText">{trans(`${KEY}.level_4_help`)}</p>
        </>
      );
    },
  },
];

export default BADGE_CARDS;
