/*
 * Cards do tema base (as chaves da tabela `$forumSettings` do extend.php).
 * Os recursos com backend trazem os próprios cards (../features).
 *
 * Molde: um recurso é um card com `master` (a chave do cabeçalho) e, no
 * miolo, só o que vale com ele ligado. Opções soltas, que não são um recurso
 * só, ficam num card sem `master`, cada uma com a sua chave.
 */
import app from 'flarum/admin/app';
import Link from 'flarum/common/components/Link';

import { trans, getBool, when } from '../util';
import { AdminNotice, AdminSubGroup, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminSelect from '../components/AdminSelect';
import AdminNumber from '../components/AdminNumber';
import { PalettePreview } from '../components/PalettePreview';
import LoaderPicker from '../components/LoaderPicker';
import ContentWidthControl from '../components/ContentWidthControl';
import { AuthPagesEditor, ForumBackgroundEditor } from '../components/AppearanceDraft';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings';

// Toda opção liga/desliga segue o mesmo molde: chave `canela.<nome>`, rótulo em
// `<nome>_label` e ajuda em `<nome>_help`.
const toggle = (name: string, extra: Record<string, any> = {}) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} {...extra} />
);

/** A ajuda da chave mestra vira a descrição do card. */
const help = (name: string) => () => trans(`${KEY}.${name}_help`);

const number = (name: string, range: { min: number; max: number; fallback: number }) => (
  <AdminNumber
    settingKey={`canela.${name}`}
    min={range.min}
    max={range.max}
    fallback={range.fallback}
    label={trans(`${KEY}.${name}_label`)}
    help={trans(`${KEY}.${name}_help`, { min: range.min, max: range.max })}
  />
);

const TAGS = ['flarum-tags'];

const CORE_CARDS: CardDef[] = [
  // ── Aparência ──────────────────────────────────────────────────────────────
  {
    // Card só de leitura: o tema não tem cor própria. Sem ele, quem procura
    // "cor" no painel do tema não acharia nada e concluiria que não dá.
    id: 'colors',
    group: 'appearance',
    icon: 'fas fa-swatchbook',
    title: () => trans(`${KEY}.section_colors`),
    description: () => trans(`${KEY}.colors_help`),
    keywords: 'cor cores color colors primária primary paleta palette aparência appearance claro escuro light dark oklch',
    body: () => (
      <>
        <PalettePreview />
        <div className="CanelaAdmin-actions">
          <Link className="Button Button--primary" href={app.route('appearance')}>
            {trans(`${KEY}.colors_link`)}
          </Link>
        </div>
      </>
    ),
  },
  {
    id: 'content-width',
    group: 'appearance',
    icon: 'fas fa-arrows-left-right',
    title: () => trans(`${KEY}.content_width_label`),
    keywords: 'largura width conteúdo content cartão card box tamanho size largo wide',
    body: () => <ContentWidthControl />,
  },
  {
    id: 'font',
    group: 'appearance',
    icon: 'fas fa-font',
    title: () => trans(`${KEY}.section_font`),
    keywords: 'fonte font tipografia typography família family inter jakarta sistema system',
    body: () => (
      <>
        {/* AdminSelect grava no `change`: cada gravação desta chave recompila o
            CSS do fórum (ela é variável do LESS), então nada de gravar por tecla. */}
        <AdminSelect
          settingKey="canela.font"
          label={trans(`${KEY}.font_label`)}
          help={trans(`${KEY}.font_help`)}
          options={{
            inter: trans(`${KEY}.font_inter`),
            jakarta: trans(`${KEY}.font_jakarta`),
            system: trans(`${KEY}.font_system`),
          }}
          default="inter"
        />
        <AdminNotice>{trans(`${KEY}.font_notice`)}</AdminNotice>
      </>
    ),
  },
  {
    id: 'surfaces',
    group: 'appearance',
    icon: 'fas fa-layer-group',
    title: () => trans(`${KEY}.section_surfaces`),
    keywords: 'fundo background tingido tinted cartão card moldura superfície surface branco',
    body: () => (
      <>
        <ForumBackgroundEditor label={trans(`${KEY}.forum_background_label`)} help={trans(`${KEY}.forum_background_help`)} />
        {toggle('content_card')}
      </>
    ),
  },
  {
    id: 'colored-accents',
    group: 'appearance',
    icon: 'fas fa-droplet',
    title: () => trans(`${KEY}.section_colored`),
    description: help('colored_accents'),
    keywords: 'cor color tag categoria category destaque accent colorido colored primária discussão',
    master: 'canela.colored_accents',
    extensions: TAGS,
    // Filha dos destaques: o logo pintado acompanha a cor da tag com eles.
    body: () => toggle('logo_colored'),
  },
  {
    id: 'pill-buttons',
    group: 'appearance',
    icon: 'fas fa-capsules',
    title: () => trans(`${KEY}.pill_buttons_label`),
    description: help('pill_buttons'),
    keywords: 'botões botão buttons button pílula pill arredondado rounded cantos radius',
    master: 'canela.pill_buttons',
  },
  {
    id: 'lucide-icons',
    group: 'appearance',
    icon: 'fas fa-icons',
    title: () => trans(`${KEY}.lucide_icons_label`),
    description: help('lucide_icons'),
    keywords: 'ícones ícone icons icon lucide font awesome traço stroke',
    master: 'canela.lucide_icons',
  },
  {
    id: 'logo-title',
    group: 'appearance',
    icon: 'fas fa-image',
    title: () => trans(`${KEY}.show_title_with_logo_label`),
    description: help('show_title_with_logo'),
    keywords: 'logo logotipo marca brand título title nome cabeçalho header',
    master: 'canela.show_title_with_logo',
  },
  {
    id: 'loading-slider',
    group: 'appearance',
    icon: 'fas fa-bars-progress',
    title: () => trans(`${KEY}.loading_slider_label`),
    description: help('loading_slider'),
    keywords: 'carregamento loading barra bar progresso progress topo top navegação transição',
    master: 'canela.loading_slider',
  },
  {
    // As chaves canela.loader_* são variáveis do LESS (extend.php): o desenho
    // escolhido vai para a folha do fórum e troca todo LoadingIndicator.
    id: 'loader',
    group: 'appearance',
    icon: 'fas fa-spinner',
    title: () => trans(`${KEY}.loader.title`),
    description: () => trans(`${KEY}.loader.help`),
    keywords: 'carregamento carregando loading loader spinner preloader indicador svg animado animação girando avocado',
    body: () => <LoaderPicker />,
  },
  {
    id: 'toast-auto-close',
    group: 'appearance',
    icon: 'far fa-bell',
    title: () => trans(`${KEY}.toast_auto_close_label`),
    description: help('toast_auto_close'),
    keywords: 'avisos alertas alerts toasts notificação fechar close automático auto tempo',
    master: 'canela.toast_auto_close',
  },

  // ── Cabeçalho e barra lateral ──────────────────────────────────────────────
  {
    id: 'header-search',
    group: 'navigation',
    icon: 'fas fa-magnifying-glass',
    title: () => trans(`${KEY}.section_header_search`),
    description: help('header_search'),
    keywords: 'busca search pesquisa cabeçalho header pílula pill',
    master: 'canela.header_search',
  },
  {
    id: 'user-menu',
    group: 'navigation',
    icon: 'far fa-circle-user',
    title: () => trans(`${KEY}.user_menu_label`),
    description: help('user_menu'),
    keywords: 'menu usuário user avatar notificações notifications sino bell painel panel cabeçalho header',
    master: 'canela.user_menu',
  },
  {
    // Chave do recurso de login/cadastro (extend/auth.php): as páginas só
    // existem com as rotas dele carregadas no servidor.
    id: 'auth-pages',
    group: 'auth',
    icon: 'fas fa-right-to-bracket',
    title: () => trans(`${KEY}.auth.pages_label`),
    description: () => trans(`${KEY}.auth.pages_help`),
    keywords: 'entrar login cadastrar cadastro signup sign up registrar página page modal conta account leiaute layout fundo background imagem',
    master: 'canela.auth_pages',
    body: () => <>{toggle('auth_pages_modals')}</>,
    lockedBy: () => (getBool('canela.auth_routes_backend') ? null : trans(`${KEY}.shell.auth_backend_off`)),
  },
  {
    // O rascunho de leiaute e fundo, com pré-visualização e "Aplicar".
    id: 'auth-layout',
    group: 'auth',
    icon: 'fas fa-table-columns',
    title: () => trans(`${KEY}.auth.layout_card_title`),
    description: () => trans(`${KEY}.auth.layout_card_help`),
    keywords: 'entrar login cadastrar cadastro signup leiaute layout cartão card tela dividida split fundo background imagem',
    dependsOn: 'canela.auth_pages',
    body: () => <AuthPagesEditor section="layout" />,
  },
  {
    id: 'auth-texts',
    group: 'auth',
    icon: 'fas fa-font',
    title: () => trans(`${KEY}.auth.texts_card_title`),
    description: () => trans(`${KEY}.auth.texts_card_help`),
    keywords: 'entrar login cadastrar cadastro signup textos título subtítulo title subtitle painel panel',
    dependsOn: 'canela.auth_pages',
    body: () => <AuthPagesEditor section="texts" />,
  },
  {
    id: 'shortcuts',
    group: 'navigation',
    icon: 'far fa-keyboard',
    title: () => trans(`${KEY}.section_shortcuts`),
    description: help('keyboard_shortcuts'),
    keywords: 'atalhos shortcuts teclado keyboard teclas keys hotkeys',
    master: 'canela.keyboard_shortcuts',
  },
  {
    id: 'sidebar',
    group: 'navigation',
    icon: 'fas fa-table-columns',
    title: () => trans(`${KEY}.section_sidebar`),
    description: help('sidebar_enabled'),
    keywords: 'barra lateral sidebar menu navegação navigation aberta open novo tópico new topic rodapé footer',
    master: 'canela.sidebar_enabled',
    body: () => (
      <>
        {toggle('sidebar_open_default')}
        {toggle('sidebar_new_topic')}
        {toggle('sidebar_footer')}
      </>
    ),
  },
  {
    id: 'sidebar-tags',
    group: 'navigation',
    icon: 'fas fa-tags',
    title: () => trans(`${KEY}.section_sidebar_tags`),
    keywords: 'categorias categories etiquetas tags barra lateral sidebar limite limit quantidade ponto dot novidades',
    dependsOn: 'canela.sidebar_enabled',
    extensions: TAGS,
    body: () => (
      <>
        {toggle('sidebar_categories')}
        {when(
          'canela.sidebar_categories',
          <AdminSubGroup>
            <AdminToggle
              settingKey="canela.sidebar_category_dots"
              label={trans('ramon-canela.admin.settings.gaps.sidebar_category_dots_label')}
              help={trans('ramon-canela.admin.settings.gaps.sidebar_category_dots_help')}
            />
          </AdminSubGroup>
        )}
        <SubDivider />
        {toggle('sidebar_tags')}
        {when('canela.sidebar_tags', <AdminSubGroup>{number('sidebar_tags_limit', { min: 1, max: 50, fallback: 6 })}</AdminSubGroup>)}
      </>
    ),
  },

  // ── Lista de tópicos ───────────────────────────────────────────────────────
  {
    id: 'welcome-banner',
    group: 'list',
    icon: 'fas fa-panorama',
    title: () => trans(`${KEY}.section_welcome_banner`),
    description: help('welcome_banner'),
    keywords: 'banner boas-vindas welcome hero visitantes guests busca search página inicial home',
    master: 'canela.welcome_banner',
    body: () => (
      <>
        {toggle('welcome_banner_guests_only')}
        {toggle('welcome_banner_search')}
      </>
    ),
  },
  {
    id: 'category-hero',
    group: 'list',
    icon: 'fas fa-folder-open',
    title: () => trans(`${KEY}.section_category_hero`),
    description: help('category_hero'),
    keywords: 'categoria category hero cabeçalho header subcategorias subcategories filhas children cartões cards tags',
    master: 'canela.category_hero',
    extensions: TAGS,
    body: () => toggle('category_hero_children'),
  },
  {
    id: 'list-tabs',
    group: 'list',
    icon: 'fas fa-bars-staggered',
    title: () => trans(`${KEY}.section_nav`),
    keywords: 'abas tabs navegação navigation não lidas unread em alta hot dias days recentes latest grudar sticky fixa',
    body: () => (
      <>
        {toggle('nav_unread')}
        <SubDivider />
        {toggle('nav_hot')}
        {when('canela.nav_hot', <AdminSubGroup>{number('hot_days', { min: 1, max: 365, fallback: 7 })}</AdminSubGroup>)}
        <SubDivider />
        {toggle('nav_sticky')}
      </>
    ),
  },
  {
    id: 'list-filters',
    group: 'list',
    icon: 'fas fa-filter',
    title: () => trans(`${KEY}.section_nav_categories`),
    keywords: 'filtros filters menus dropdowns categorias categories etiquetas tags aba tab navegação',
    extensions: TAGS,
    body: () => (
      <>
        {toggle('nav_dropdowns')}
        {toggle('nav_categories_link')}
      </>
    ),
  },
  {
    id: 'list-columns',
    group: 'list',
    icon: 'fas fa-table-list',
    title: () => trans(`${KEY}.section_list_columns`),
    keywords:
      'colunas columns cabeçalho header participantes posters avatares avatars visualizações views calor heat contagem resumo excerpt fixados pinned',
    body: () => (
      <>
        {toggle('list_header')}
        {toggle('list_posters')}
        {toggle('list_views', {
          dependsOn: 'canela.stats_views_enabled',
        })}
        {toggle('list_heat')}
        {toggle('list_excerpts')}
        <AdminSelect
          settingKey="canela.list_status_icons"
          label={trans(`${KEY}.list_status_icons_label`)}
          help={trans(`${KEY}.list_status_icons_help`)}
          options={{
            muted: trans(`${KEY}.list_status_icons_muted`),
            colored: trans(`${KEY}.list_status_icons_colored`),
          }}
          default="muted"
        />
      </>
    ),
  },
  {
    id: 'infinite-scroll',
    group: 'list',
    icon: 'fas fa-arrows-down-to-line',
    title: () => trans(`${KEY}.list_infinite_scroll_label`),
    description: help('list_infinite_scroll'),
    keywords: 'rolagem infinita infinite scroll carregar mais load more paginação pagination',
    master: 'canela.list_infinite_scroll',
  },
  {
    id: 'categories-page',
    group: 'list',
    icon: 'fas fa-table-cells-large',
    title: () => trans(`${KEY}.section_categories_page`),
    keywords: 'categorias categories página page caixas boxes lista list layout tags',
    extensions: TAGS,
    body: () => (
      <AdminSelect
        settingKey="canela.categories_layout"
        label={trans(`${KEY}.categories_layout_label`)}
        help={trans(`${KEY}.categories_layout_help`)}
        options={{
          boxes: trans(`${KEY}.categories_layout_boxes`),
          list: trans(`${KEY}.categories_layout_list`),
        }}
        default="boxes"
      />
    ),
  },

  // ── Tópico ─────────────────────────────────────────────────────────────────
  {
    id: 'topic-map',
    group: 'topic',
    icon: 'fas fa-map',
    title: () => trans(`${KEY}.section_topic_map`),
    description: help('topic_map'),
    keywords: 'mapa map resumo summary participantes respostas replies tópico topic',
    master: 'canela.topic_map',
  },
  {
    id: 'topic-timeline',
    group: 'topic',
    icon: 'fas fa-timeline',
    title: () => trans(`${KEY}.section_topic_timeline`),
    description: help('topic_timeline'),
    keywords: 'linha do tempo timeline rolagem scrubber navegação postagens posts tópico voltar back',
    master: 'canela.topic_timeline',
    body: () => (
      <AdminToggle
        settingKey="canela.timeline_back"
        label={trans('ramon-canela.admin.settings.gaps.timeline_back_label')}
        help={trans('ramon-canela.admin.settings.gaps.timeline_back_help')}
      />
    ),
  },
  {
    // O post padrão com a linha do tempo do avocado ligando os avatares
    // (less/forum/PostDirect.less, pela classe Canela--postDirect). Vale para
    // todos: a escolha é só do admin.
    id: 'post-style',
    group: 'topic',
    icon: 'fas fa-comments',
    title: () => trans(`${KEY}.post_style_label`),
    keywords: 'estilo style postagens posts discussão discussion direto direct avocado linha do tempo timeline avatar conversa conversation',
    body: () => (
      <AdminSelect
        settingKey="canela.post_style"
        label={trans(`${KEY}.post_style_label`)}
        help={trans(`${KEY}.post_style_help`)}
        options={{
          discourse: trans(`${KEY}.post_style_discourse`),
          direct: trans(`${KEY}.post_style_direct`),
        }}
        default="discourse"
      />
    ),
  },
  {
    // O "em resposta a" do avocado (uma linha embaixo do nome), independente
    // da linha do tempo e das respostas embutidas.
    id: 'reply-to-style',
    group: 'topic',
    icon: 'fas fa-reply',
    title: () => trans(`${KEY}.topic_reply_to_style_label`),
    keywords: 'em resposta a in reply to resposta reply menção mention cabeçalho header avocado linha line',
    extensions: ['flarum-mentions'],
    body: () => (
      <AdminSelect
        settingKey="canela.topic_reply_to_style"
        label={trans(`${KEY}.topic_reply_to_style_label`)}
        help={trans(`${KEY}.topic_reply_to_style_help`)}
        options={{
          discourse: trans(`${KEY}.topic_reply_to_style_discourse`),
          avocado: trans(`${KEY}.topic_reply_to_style_avocado`),
        }}
        default="discourse"
      />
    ),
  },
  {
    id: 'post-username-first',
    group: 'topic',
    icon: 'fas fa-at',
    title: () => trans(`${KEY}.post_username_first_label`),
    description: help('post_username_first'),
    keywords: 'nome name usuário username apelido nickname exibição display cabeçalho header postagens posts',
    master: 'canela.post_username_first',
  },
  {
    id: 'post-actions',
    group: 'topic',
    icon: 'fas fa-ellipsis',
    title: () => trans(`${KEY}.post_actions_label`),
    description: help('post_actions'),
    keywords: 'ações actions barra bar postagem post curtir like responder reply menu controles controls',
    master: 'canela.post_actions',
  },
  {
    id: 'embedded-replies',
    group: 'topic',
    icon: 'fas fa-reply-all',
    title: () => trans(`${KEY}.embedded_replies_label`),
    description: help('embedded_replies'),
    keywords: 'respostas replies embutidas embedded menções mentions citação quote abaixo inline',
    master: 'canela.embedded_replies',
    extensions: ['flarum-mentions'],
  },
  {
    id: 'new-replies-bar',
    group: 'topic',
    icon: 'fas fa-arrow-down-short-wide',
    title: () => trans(`${KEY}.new_replies_bar_label`),
    description: help('new_replies_bar'),
    keywords: 'novas respostas new replies tempo real realtime barra bar aviso websocket',
    master: 'canela.new_replies_bar',
    extensions: ['flarum-realtime'],
  },
  {
    id: 'event-posts',
    group: 'topic',
    icon: 'fas fa-thumbtack',
    title: () => trans(`${KEY}.topic_event_posts_label`),
    description: help('topic_event_posts'),
    keywords: 'eventos event posts trancou fixou locked pinned renomeou renamed avisos',
    master: 'canela.topic_event_posts',
  },
  {
    id: 'sticky-avatar',
    group: 'topic',
    icon: 'fas fa-user-pen',
    title: () => trans(`${KEY}.topic_sticky_avatar_label`),
    description: help('topic_sticky_avatar'),
    keywords: 'avatar fixo sticky acompanha rolagem scroll fixed avatar post longo',
    master: 'canela.topic_sticky_avatar',
  },
  {
    id: 'topic-footer',
    group: 'topic',
    icon: 'fas fa-grip-lines',
    title: () => trans(`${KEY}.section_topic_footer`),
    description: help('topic_footer'),
    keywords: 'rodapé footer botões buttons responder reply compartilhar share acompanhar follow subscriptions acompanhando notificações',
    master: 'canela.topic_footer',
    body: () => toggle('topic_footer_notifications'),
  },
  {
    id: 'suggested',
    group: 'topic',
    icon: 'far fa-lightbulb',
    title: () => trans(`${KEY}.section_suggested`),
    description: help('suggested_topics'),
    keywords: 'sugeridos suggested relacionados related tópicos topics quantidade count',
    master: 'canela.suggested_topics',
    body: () => number('suggested_count', { min: 1, max: 20, fallback: 5 }),
  },

  // ── Perfil e usuários ──────────────────────────────────────────────────────
  {
    id: 'user-page',
    group: 'people',
    icon: 'far fa-id-badge',
    title: () => trans(`${KEY}.section_user_page`),
    keywords:
      'perfil profile usuário user capa cover estatísticas stats resumo summary aba tab atividade activity lidos read reações reactions votos votes resolvido solved',
    body: () => (
      <>
        {toggle('user_cover')}
        {toggle('user_stats')}
        {toggle('user_summary')}
        {/* Sem a aba Resumo, abrir o perfil nela não tem para onde ir. */}
        {getBool('canela.user_summary') && (
          <AdminSubGroup>
            <AdminSelect
              settingKey="canela.user_default_tab"
              label={trans(`${KEY}.user_default_tab_label`)}
              help={trans(`${KEY}.user_default_tab_help`)}
              options={{
                activity: trans(`${KEY}.user_default_tab_activity`),
                summary: trans(`${KEY}.user_default_tab_summary`),
              }}
              default="summary"
            />
          </AdminSubGroup>
        )}
        {/* As subabas de "Atividade" que dependem de uma extensão (extend/activity.php). */}
        {toggle('user_activity_read')}
        {toggle('user_activity_reactions', { extension: 'fof-reactions' })}
        {toggle('user_activity_votes', { extension: 'fof-polls' })}
        {toggle('user_activity_solved', {
          extension: 'fof-best-answer',
        })}
      </>
    ),
  },
  {
    id: 'user-card',
    group: 'people',
    icon: 'far fa-address-card',
    title: () => trans(`${KEY}.section_user_card`),
    description: help('user_card'),
    keywords: 'cartão card usuário user perfil profile avatar nome popup menção mention',
    master: 'canela.user_card',
    body: () => (
      <AdminToggle
        settingKey="canela.mention_cards"
        label={trans('ramon-canela.admin.settings.gaps.mention_cards_label')}
        help={trans('ramon-canela.admin.settings.gaps.mention_cards_help')}
      />
    ),
  },
];

export default CORE_CARDS;
