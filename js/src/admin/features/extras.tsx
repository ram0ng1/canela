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

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

/** Um id novo faz o banner reaparecer para quem tinha fechado o anterior. */
const newBannerId = (): string => Date.now().toString(36);

const cards: CardDef[] = [
  // ── Editor e busca ─────────────────────────────────────────────────────────
  {
    id: 'search-page',
    group: 'composer',
    icon: 'fas fa-magnifying-glass-plus',
    title: () => trans(`${KEY}.search_title`, 'Página de busca'),
    description: help(
      'search_page_enabled',
      'A página /search: abas de discussões, postagens, tags e usuários, filtros avançados (autor, tag primária, tags, só no título, curtidos, status, datas, mínimo de postagens) e ordenação. O modal de busca ganha o link "Busca avançada".'
    ),
    keywords: 'busca pesquisa search página page avançada advanced filtros filters gambits ordenar sort resultados results',
    master: 'canela.search_page_enabled',
    body: () => (
      <AdminNotice>
        {trans(
          `${KEY}.search_notice`,
          'Os filtros também viram atalhos que se digitam na busca: em:título, em:curtidos, em:marcadores e mín-postagens:5, ao lado dos do Flarum (autor:, tag:, é:trancada…).'
        )}
      </AdminNotice>
    ),
  },

  // ── Moderação ──────────────────────────────────────────────────────────────
  {
    id: 'bulk-select',
    group: 'moderation',
    icon: 'fas fa-list-check',
    title: () => trans(`${KEY}.bulk_title`, 'Seleção em massa'),
    description: help(
      'bulk_select_enabled',
      'Um botão na barra da lista liga caixas de seleção em cada discussão e uma barra de ações: marcar como lida, fixar, trancar, alterar tags, ocultar e excluir. Só aparece para quem pode moderar alguma discussão da lista, e cada ação só vale onde a pessoa tem permissão.'
    ),
    keywords: 'seleção massa bulk selecionar select moderação moderation fixar trancar etiquetas excluir ocultar lote',
    master: 'canela.bulk_select_enabled',
  },

  // ── Lista de tópicos ───────────────────────────────────────────────────────
  {
    id: 'top-periods',
    group: 'list',
    icon: 'fas fa-trophy',
    title: () => trans(`${KEY}.top_periods_title`, 'Melhores por período'),
    description: help(
      'top_periods_enabled',
      'Na aba Melhores aparece "Todo o período / Ano / Trimestre / Mês / Semana / Hoje", que limita a lista às discussões criadas no intervalo.'
    ),
    keywords: 'melhores top período period ano mês semana dia trimestre ranking',
    master: 'canela.top_periods_enabled',
  },

  // ── Aparência ──────────────────────────────────────────────────────────────
  {
    id: 'text-size',
    group: 'appearance',
    icon: 'fas fa-text-height',
    title: () => trans(`${KEY}.text_size_title`, 'Tamanho do texto'),
    description: help(
      'text_size_enabled',
      'Em Configurações, cada pessoa escolhe Menor, Normal, Maior ou Máximo. A escolha vale para o aparelho (fica no navegador).'
    ),
    keywords: 'tamanho texto fonte letra text size font acessibilidade accessibility zoom maior menor',
    master: 'canela.text_size_enabled',
  },
  {
    id: 'announcement',
    group: 'appearance',
    icon: 'fas fa-bullhorn',
    title: () => trans(`${KEY}.banner_title`, 'Banner de anúncio'),
    description: help(
      'banner_enabled',
      'Uma faixa acima do conteúdo, em todas as páginas, com um botão de fechar. Quem fecha não vê de novo, até o texto mudar.'
    ),
    keywords: 'banner anúncio aviso announcement faixa topo mensagem global notice',
    master: 'canela.banner_enabled',
    body: () => (
      <>
        <AdminTextarea
          settingKey="canela.banner_text"
          rows={5}
          label={trans(`${KEY}.banner_text_label`, 'Texto do banner')}
          help={trans(
            `${KEY}.banner_text_help`,
            'Markdown, BBCode e emoji, como numa postagem. Para HTML, comece o texto com uma tag HTML (p, div…). Vazio, o banner não aparece.'
          )}
          extraPayload={() => ({ 'canela.banner_id': newBannerId() })}
        />
        <div className="CanelaAdmin-actions">
          <Button
            className="Button"
            icon="fas fa-rotate"
            onclick={() => {
              const id = newBannerId();
              app.data.settings['canela.banner_id'] = id;
              saveSetting({ 'canela.banner_id': id }).then(() =>
                app.alerts.show({ type: 'success' }, trans(`${KEY}.banner_reshow_done`, 'O banner vai aparecer de novo para todos.'))
              );
            }}
          >
            {trans(`${KEY}.banner_reshow`, 'Mostrar de novo para quem fechou')}
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
    title: () => trans(`${KEY}.print_title`, 'Imprimir discussão'),
    description: help(
      'print_topic_enabled',
      'Carrega todas as postagens numa visão limpa (sem barra lateral, cabeçalho nem linha do tempo) e abre a impressão do navegador, que também salva em PDF.'
    ),
    keywords: 'imprimir print impressão pdf papel tópico',
    master: 'canela.print_topic_enabled',
  },

  // ── Moderação ──────────────────────────────────────────────────────────────
  {
    id: 'post-history',
    group: 'moderation',
    icon: 'fas fa-clock-rotate-left',
    title: () => trans(`${KEY}.history_title`, 'Histórico de edições'),
    description: help(
      'post_history_enabled',
      'Cada edição guarda o texto anterior. O "Editado" do post vira um lápis com o número de revisões, que abre a comparação entre as versões (no texto ou lado a lado).'
    ),
    keywords: 'histórico edições revisões history revisions editado edited diff versões comparar lápis',
    master: 'canela.post_history_enabled',
    body: () => (
      <>
        <AdminToggle
          settingKey="canela.post_history_public"
          label={trans(`${KEY}.post_history_public_label`, 'Histórico visível para todos')}
          help={trans(
            `${KEY}.post_history_public_help`,
            'Desligado, só o autor do post e quem pode editá-lo abrem o histórico; os demais veem o "Editado" do Flarum.'
          )}
        />
        <AdminNotice>
          {trans(
            `${KEY}.history_notice`,
            'Só as edições feitas com o recurso ligado entram no histórico. Desligado, nada novo é guardado e o histórico some do fórum, o que já foi guardado fica no banco. O texto das versões de um post oculto só aparece para quem pode editá-lo.'
          )}
        </AdminNotice>
      </>
    ),
  },
];

export default cards;
