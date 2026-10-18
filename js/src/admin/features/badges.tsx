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

const toggle = (name: string, label: string, help: string, dependsOn?: string) => (
  <AdminToggle
    settingKey={`canela.${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, help)}
    dependsOn={dependsOn}
  />
);

const requirement = (name: string, fallback: number, label: string, suffix?: string, max = 100000) => (
  <AdminNumber
    settingKey={`canela.${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    min={0}
    max={max}
    fallback={fallback}
    suffix={suffix ? trans(`${KEY}.unit_${suffix}`, suffix) : undefined}
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
          {trans(`${KEY}.run_now`, 'Conceder emblemas agora')}
        </Button>
        {this.done && <span className="CanelaAdmin-badgesRunDone">{trans(`${KEY}.run_done`, 'Pronto.')}</span>}
        <p className="helpText">
          {trans(
            `${KEY}.run_help`,
            'O comando canela:badges roda uma vez por dia pelo agendador do Flarum (php flarum schedule:run no cron). A primeira carga concede o histórico do fórum sem notificar ninguém. Este botão roda só a parte dos emblemas, agora.'
          )}
        </p>
      </div>
    );
  }

  run(): void {
    this.loading = true;
    this.done = false;

    app
      .request({ method: 'POST', url: `${apiUrl()}/badges/recalculate` })
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
    title: () => trans(`${KEY}.badges_enabled_label`, 'Emblemas'),
    description: () =>
      trans(
        `${KEY}.badges_enabled_help`,
        'Os emblemas automáticos do Discourse (Primeira curtida, Resposta interessante, Aniversário…), a página /badges, a aba Emblemas do perfil e a notificação "Ganhou …". Desligados, nada disso aparece e a API responde 404.'
      ),
    keywords: 'emblemas badges conquistas medalhas curtidas likes conceder grant',
    master: 'canela.badges_enabled',
    body: () => (
      <>
        {toggle(
          'badges_user_card',
          'Emblemas no cartão do usuário',
          'Até três emblemas de destaque (ouro, prata, bronze) no cartão que abre ao clicar num avatar.',
          'canela.user_card'
        )}
        {toggle('badges_summary', 'Melhores emblemas no Resumo', 'A seção de emblemas na aba Resumo do perfil.', 'canela.user_summary')}
        <AdminNumber
          settingKey="canela.badges_max_likes_per_day"
          label={trans(`${KEY}.badges_max_likes_per_day_label`, 'Curtidas por dia dos emblemas "Por amor"')}
          help={trans(
            `${KEY}.badges_max_likes_per_day_help`,
            'O Flarum não limita curtidas; os emblemas Por amor, Amor maior e Apaixonado(a) contam os dias em que a pessoa deu pelo menos este número de curtidas (o padrão do Discourse é 50).'
          )}
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
    title: () => trans(`${KEY}.section_manager`, 'Gerenciar emblemas'),
    description: () =>
      trans(
        `${KEY}.table_help`,
        'Desligar um emblema o tira da página /badges e dos perfis e para as concessões novas; as já feitas continuam guardadas e voltam se ele for religado.'
      ),
    keywords: 'emblemas badges lista tabela ligar desligar criar novo remover restaurar conceder revogar personalizado',
    dependsOn: 'canela.badges_enabled',
    body: () => <BadgeManager />,
  },
  {
    id: 'trust-levels',
    group: 'community',
    icon: 'fas fa-shield-halved',
    title: () => trans(`${KEY}.trust_levels_enabled_label`, 'Níveis de confiança'),
    description: () =>
      trans(
        `${KEY}.trust_levels_enabled_help`,
        'Novo, Básico, Membro, Regular e Líder, calculados pelos requisitos do card abaixo. O nível aparece no perfil e rende os emblemas de nível. O Líder só é dado à mão: no perfil, menu de moderação, "Alterar nível de confiança…".'
      ),
    keywords: 'níveis confiança trust levels requisitos promoção básico membro regular líder',
    master: 'canela.trust_levels_enabled',
    body: () => {
      const caps = capabilities();
      const measured = caps.visits && caps.topicViews;

      return (
        <>
          <AdminNotice icon={measured ? 'fas fa-chart-line' : 'fas fa-circle-info'}>
            {measured
              ? trans(
                  `${KEY}.source_stats`,
                  'Leitura medida pelas estatísticas do tema: dias visitados, tempo de leitura, discussões vistas e postagens lidas são os de verdade, como no Discourse.'
                )
              : trans(
                  `${KEY}.source_core`,
                  'Sem as estatísticas do tema, a leitura vem do estado de leitura do Flarum (até onde cada pessoa leu cada discussão), os dias visitados viram dias desde o cadastro e o tempo de leitura não conta.'
                )}
            {!caps.likes && ' ' + trans(`${KEY}.no_likes`, 'Sem o flarum/likes, os requisitos de curtidas não contam.')}
          </AdminNotice>

          <SubTitle>{trans(`${KEY}.level_1`, '1 · Básico')}</SubTitle>
          <AdminSubGroup>
            {requirement('tl1_requires_topics_entered', 5, 'Discussões vistas')}
            {requirement('tl1_requires_read_posts', 30, 'Postagens lidas')}
            {requirement('tl1_requires_time_spent_mins', 10, 'Tempo de leitura', 'minutes')}
          </AdminSubGroup>

          <SubTitle>{trans(`${KEY}.level_2`, '2 · Membro')}</SubTitle>
          <AdminSubGroup>
            {requirement('tl2_requires_topics_entered', 20, 'Discussões vistas')}
            {requirement('tl2_requires_read_posts', 100, 'Postagens lidas')}
            {requirement('tl2_requires_time_spent_mins', 60, 'Tempo de leitura', 'minutes')}
            {requirement('tl2_requires_days_visited', 15, 'Dias visitados', 'days')}
            {requirement('tl2_requires_likes_received', 1, 'Curtidas recebidas')}
            {requirement('tl2_requires_likes_given', 1, 'Curtidas dadas')}
            {requirement('tl2_requires_topic_reply_count', 3, 'Discussões de outras pessoas respondidas')}
          </AdminSubGroup>

          <SubTitle>{trans(`${KEY}.level_3`, '3 · Regular')}</SubTitle>
          <AdminSubGroup>
            {requirement('tl3_time_period', 100, 'Janela de avaliação', 'days', 1000)}
            {requirement('tl3_requires_days_visited', 50, 'Dias visitados na janela', 'days')}
            {requirement('tl3_requires_topics_replied_to', 10, 'Discussões respondidas na janela')}
            {requirement('tl3_requires_topics_viewed', 25, 'Discussões vistas (das criadas na janela)', 'percent', 100)}
            {requirement('tl3_requires_topics_viewed_cap', 250, 'Teto de discussões vistas')}
            {requirement('tl3_requires_posts_read', 25, 'Postagens lidas (das criadas na janela)', 'percent', 100)}
            {requirement('tl3_requires_posts_read_cap', 2000, 'Teto de postagens lidas')}
            {requirement('tl3_requires_topics_viewed_all_time', 200, 'Discussões vistas desde o início')}
            {requirement('tl3_requires_posts_read_all_time', 500, 'Postagens lidas desde o início')}
            {requirement('tl3_requires_max_flagged', 5, 'Máximo de postagens sinalizadas')}
            {requirement('tl3_requires_likes_given', 30, 'Curtidas dadas na janela')}
            {requirement('tl3_requires_likes_received', 20, 'Curtidas recebidas na janela')}
            {requirement('tl3_promotion_min_duration', 100, 'Carência antes de perder o nível', 'days', 10000)}
          </AdminSubGroup>

          <SubTitle>{trans(`${KEY}.level_4`, '4 · Líder')}</SubTitle>
          <p className="helpText">
            {trans(
              `${KEY}.level_4_help`,
              'Nunca automático: só a administração concede, pelo menu de moderação do perfil. Escolher um nível à mão também o fixa (o sistema não promove nem rebaixa).'
            )}
          </p>
        </>
      );
    },
  },
];

export default BADGE_CARDS;
