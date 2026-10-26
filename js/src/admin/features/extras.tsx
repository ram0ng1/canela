/*
 * Cards dos recursos "extras": página de busca (Editor e busca), "Melhores"
 * por período (Lista), tamanho do texto e banner de anúncio (Aparência),
 * imprimir (Tópico), seleção em massa e histórico de edições (Moderação).
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';

import { AdminNotice } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminTextarea from './AdminTextarea';
import { saveSetting, trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.extras';

const help = (name: string) => () => trans(`${KEY}.${name}_help`);

/** Um id novo faz o banner reaparecer para quem tinha fechado o anterior. */
const newBannerId = (): string => Date.now().toString(36);

const cards: CardDef[] = [
  // ── Editor e busca ─────────────────────────────────────────────────────────
  {
    id: 'search-page',
    group: 'composer',
    icon: 'fas fa-magnifying-glass-plus',
    title: () => trans(`${KEY}.search_title`),
    description: help('search_page_enabled'),
    keywords: 'busca pesquisa search página page avançada advanced filtros filters gambits ordenar sort resultados results',
    master: 'canela.search_page_enabled',
    body: () => <AdminNotice>{trans(`${KEY}.search_notice`)}</AdminNotice>,
  },

  // ── Moderação ──────────────────────────────────────────────────────────────
  {
    id: 'bulk-select',
    group: 'moderation',
    icon: 'fas fa-list-check',
    title: () => trans(`${KEY}.bulk_title`),
    description: help('bulk_select_enabled'),
    keywords: 'seleção massa bulk selecionar select moderação moderation fixar trancar etiquetas excluir ocultar lote',
    master: 'canela.bulk_select_enabled',
  },

  // ── Lista de tópicos ───────────────────────────────────────────────────────
  {
    id: 'top-periods',
    group: 'list',
    icon: 'fas fa-trophy',
    title: () => trans(`${KEY}.top_periods_title`),
    description: help('top_periods_enabled'),
    keywords: 'melhores top período period ano mês semana dia trimestre ranking',
    master: 'canela.top_periods_enabled',
  },

  // ── Aparência ──────────────────────────────────────────────────────────────
  {
    id: 'text-size',
    group: 'appearance',
    icon: 'fas fa-text-height',
    title: () => trans(`${KEY}.text_size_title`),
    description: help('text_size_enabled'),
    keywords: 'tamanho texto fonte letra text size font acessibilidade accessibility zoom maior menor',
    master: 'canela.text_size_enabled',
  },
  {
    id: 'announcement',
    group: 'appearance',
    icon: 'fas fa-bullhorn',
    title: () => trans(`${KEY}.banner_title`),
    description: help('banner_enabled'),
    keywords: 'banner anúncio aviso announcement faixa topo mensagem global notice',
    master: 'canela.banner_enabled',
    body: () => (
      <>
        <AdminTextarea
          settingKey="canela.banner_text"
          rows={5}
          label={trans(`${KEY}.banner_text_label`)}
          help={trans(`${KEY}.banner_text_help`)}
          extraPayload={() => ({ 'canela.banner_id': newBannerId() })}
        />
        <div className="CanelaAdmin-actions">
          <Button
            className="Button"
            icon="fas fa-rotate"
            onclick={() => {
              const id = newBannerId();
              app.data.settings['canela.banner_id'] = id;
              saveSetting({ 'canela.banner_id': id }).then(() => app.alerts.show({ type: 'success' }, trans(`${KEY}.banner_reshow_done`)));
            }}
          >
            {trans(`${KEY}.banner_reshow`)}
          </Button>
        </div>
      </>
    ),
  },

  // ── Tópico ─────────────────────────────────────────────────────────────────
  {
    id: 'print',
    group: 'topic',
    icon: 'fas fa-print',
    title: () => trans(`${KEY}.print_title`),
    description: help('print_topic_enabled'),
    keywords: 'imprimir print impressão pdf papel tópico',
    master: 'canela.print_topic_enabled',
  },

  // ── Moderação ──────────────────────────────────────────────────────────────
  {
    id: 'post-history',
    group: 'moderation',
    icon: 'fas fa-clock-rotate-left',
    title: () => trans(`${KEY}.history_title`),
    description: help('post_history_enabled'),
    keywords: 'histórico edições revisões history revisions editado edited diff versões comparar lápis',
    master: 'canela.post_history_enabled',
    body: () => (
      <>
        <AdminToggle
          settingKey="canela.post_history_public"
          label={trans(`${KEY}.post_history_public_label`)}
          help={trans(`${KEY}.post_history_public_help`)}
        />
        <AdminNotice>{trans(`${KEY}.history_notice`)}</AdminNotice>
      </>
    ),
  },
];

export default cards;
