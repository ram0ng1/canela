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

import { trans, getBool, getStr, when } from '../util';
import { AdminNotice, AdminSubGroup, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminSelect from '../components/AdminSelect';
import AdminNumber from '../components/AdminNumber';
import { PalettePreview } from '../components/PalettePreview';
import LoaderPicker from '../components/LoaderPicker';
import ContentWidthControl from '../components/ContentWidthControl';
import BackgroundPicker from '../components/BackgroundPicker';
import { AdminTextField } from '../features/community';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings';

// Toda opção liga/desliga segue o mesmo molde: chave `canela.<nome>`, rótulo em
// `<nome>_label` e ajuda em `<nome>_help`.
const toggle = (name: string, label: string, help: string, extra: Record<string, any> = {}) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} {...extra} />
);

/** A ajuda da chave mestra vira a descrição do card. */
const help = (name: string, text: string) => () => trans(`${KEY}.${name}_help`, text);

const number = (name: string, range: { min: number; max: number; fallback: number }, label: string, helpText: string) => (
  <AdminNumber
    settingKey={`canela.${name}`}
    min={range.min}
    max={range.max}
    fallback={range.fallback}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, helpText, { min: range.min, max: range.max })}
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
    title: () => trans(`${KEY}.section_colors`, 'Cores'),
    description: () =>
      trans(
        `${KEY}.colors_help`,
        'O tema não tem cores próprias: a paleta inteira sai da cor primária do Flarum, como o Horizon do Discourse faz com a cor terciária. O fundo tingido, a seleção, os links e o anel de foco são derivados dela, no modo claro e no escuro.'
      ),
    keywords: 'cor cores color colors primária primary paleta palette aparência appearance claro escuro light dark oklch',
    body: () => (
      <>
        <PalettePreview />
        <div className="CanelaAdmin-actions">
          <Link className="Button Button--primary" href={app.route('appearance')}>
            {trans(`${KEY}.colors_link`, 'Mudar a cor em Aparência')}
          </Link>
        </div>
      </>
    ),
  },
  {
    id: 'content-width',
    group: 'appearance',
    icon: 'fas fa-arrows-left-right',
    title: () => trans(`${KEY}.content_width_label`, 'Largura do conteúdo'),
    keywords: 'largura width conteúdo content cartão card box tamanho size largo wide',
    body: () => <ContentWidthControl />,
  },
  {
    id: 'font',
    group: 'appearance',
    icon: 'fas fa-font',
    title: () => trans(`${KEY}.section_font`, 'Fonte'),
    keywords: 'fonte font tipografia typography família family inter jakarta sistema system',
    body: () => (
      <>
        {/* AdminSelect grava no `change`: cada gravação desta chave recompila o
            CSS do fórum (ela é variável do LESS), então nada de gravar por tecla. */}
        <AdminSelect
          settingKey="canela.font"
          label={trans(`${KEY}.font_label`, 'Fonte do fórum')}
          help={trans(
            `${KEY}.font_help`,
            'A família usada no fórum inteiro. Inter e Plus Jakarta Sans vêm com o tema e cobrem as letras latinas; a do sistema não baixa nada e cobre qualquer escrita.'
          )}
          options={{
            inter: trans(`${KEY}.font_inter`, 'Inter: padrão do tema'),
            jakarta: trans(`${KEY}.font_jakarta`, 'Plus Jakarta Sans'),
            system: trans(`${KEY}.font_system`, 'Fonte do sistema'),
          }}
          default="inter"
        />
        <AdminNotice>{trans(`${KEY}.font_notice`, 'Trocar a fonte recompila o CSS do fórum; a gravação leva alguns segundos.')}</AdminNotice>
      </>
    ),
  },
  {
    id: 'surfaces',
    group: 'appearance',
    icon: 'fas fa-layer-group',
    title: () => trans(`${KEY}.section_surfaces`, 'Fundo e cartão'),
    keywords: 'fundo background tingido tinted cartão card moldura superfície surface branco',
    body: () => (
      <>
        <BackgroundPicker
          target="forum"
          label={trans(`${KEY}.forum_background_label`, 'Fundo do fórum')}
          help={trans(
            `${KEY}.forum_background_help`,
            'O que fica atrás do conteúdo e da barra lateral. O degradê tingido (com ou sem os ícones desfocados) e a cor tingida puxam a cor primária, como no Horizon; o liso fica num cinza neutro.'
          )}
        />
        {toggle(
          'content_card',
          'Conteúdo dentro de um cartão',
          'A lista, a discussão e o perfil ficam num cartão de cantos arredondados sobre o fundo. Desligado, o conteúdo ocupa a área toda, sem moldura.'
        )}
      </>
    ),
  },
  {
    id: 'colored-accents',
    group: 'appearance',
    icon: 'fas fa-droplet',
    title: () => trans(`${KEY}.section_colored`, 'Destaques coloridos'),
    description: help(
      'colored_accents',
      'Numa página de tag ou numa discussão, a cor de destaque do tema (botões, links, aba ativa, fundo tingido) passa a ser a cor da tag primária. Fora delas, volta a cor primária do fórum.'
    ),
    keywords: 'cor color tag categoria category destaque accent colorido colored primária discussão',
    master: 'canela.colored_accents',
    extensions: TAGS,
    // Filha dos destaques: o logo pintado acompanha a cor da tag com eles.
    body: () =>
      toggle(
        'logo_colored',
        'Pintar o logo',
        'O logo enviado vira só a forma, pintado na cor de destaque (e na cor da tag nas páginas de tag e discussões). Funciona melhor com SVG ou PNG com fundo transparente.'
      ),
  },
  {
    id: 'pill-buttons',
    group: 'appearance',
    icon: 'fas fa-capsules',
    title: () => trans(`${KEY}.pill_buttons_label`, 'Botões em pílula'),
    description: help(
      'pill_buttons',
      'Botões com as pontas totalmente arredondadas, como no Horizon. Desligado, ficam com cantos levemente arredondados.'
    ),
    keywords: 'botões botão buttons button pílula pill arredondado rounded cantos radius',
    master: 'canela.pill_buttons',
  },
  {
    id: 'lucide-icons',
    group: 'appearance',
    icon: 'fas fa-icons',
    title: () => trans(`${KEY}.lucide_icons_label`, 'Ícones do Discourse (Lucide)'),
    description: help(
      'lucide_icons',
      'Os ícones de interface (busca, sino, responder, curtir, menus…) com o traço fino do Lucide, como no meta.discourse.org. Desligado, voltam os ícones sólidos do Font Awesome. Os que o Meta não troca (marcas e parte dos escolhidos para tags e grupos) continuam no Font Awesome.'
    ),
    keywords: 'ícones ícone icons icon lucide font awesome traço stroke discourse meta',
    master: 'canela.lucide_icons',
  },
  {
    id: 'logo-title',
    group: 'appearance',
    icon: 'fas fa-image',
    title: () => trans(`${KEY}.show_title_with_logo_label`, 'Mostrar o título do fórum ao lado do logo'),
    description: help(
      'show_title_with_logo',
      'Com um logo enviado em Aparência, o título só aparece ao lado dele com esta opção ligada. Sem logo, o título aparece sempre.'
    ),
    keywords: 'logo logotipo marca brand título title nome cabeçalho header',
    master: 'canela.show_title_with_logo',
  },
  {
    id: 'loading-slider',
    group: 'appearance',
    icon: 'fas fa-bars-progress',
    title: () => trans(`${KEY}.loading_slider_label`, 'Barra de carregamento no topo'),
    description: help(
      'loading_slider',
      'Na troca de página, uma barrinha fina corre no topo da tela até a página chegar, como no Discourse, no lugar do aviso "Carregando…" do Flarum.'
    ),
    keywords: 'carregamento loading barra bar progresso progress topo top navegação transição',
    master: 'canela.loading_slider',
  },
  {
    // As chaves canela.loader_* são variáveis do LESS (extend.php): o desenho
    // escolhido vai para a folha do fórum e troca todo LoadingIndicator.
    id: 'loader',
    group: 'appearance',
    icon: 'fas fa-spinner',
    title: () => trans(`${KEY}.loader.title`, 'Indicador de carregamento'),
    description: () =>
      trans(
        `${KEY}.loader.help`,
        'O desenho que aparece enquanto algo carrega: na lista, nos posts, no perfil, nos modais, nos menus, nos botões, no editor, nas extensões e na primeira carga da página. Troque o anel cinza do Flarum por um SVG animado.'
      ),
    keywords: 'carregamento carregando loading loader spinner preloader indicador svg animado animação girando avocado',
    body: () => <LoaderPicker />,
  },
  {
    id: 'toast-auto-close',
    group: 'appearance',
    icon: 'far fa-bell',
    title: () => trans(`${KEY}.toast_auto_close_label`, 'Avisos que fecham sozinhos'),
    description: help(
      'toast_auto_close',
      'Os avisos do canto da tela ("Salvo", "Link copiado"…) somem sozinhos depois de alguns segundos, com a barrinha de tempo, como os toasts do Discourse. Desligado, ficam até alguém fechar.'
    ),
    keywords: 'avisos alertas alerts toasts notificação fechar close automático auto tempo',
    master: 'canela.toast_auto_close',
  },

  // ── Cabeçalho e barra lateral ──────────────────────────────────────────────
  {
    id: 'header-search',
    group: 'navigation',
    icon: 'fas fa-magnifying-glass',
    title: () => trans(`${KEY}.section_header_search`, 'Busca no cabeçalho'),
    description: help(
      'header_search',
      'A pílula de busca no meio do cabeçalho, como no Discourse. Desligada, o cabeçalho volta à busca padrão do Flarum.'
    ),
    keywords: 'busca search pesquisa cabeçalho header pílula pill',
    master: 'canela.header_search',
  },
  {
    id: 'user-menu',
    group: 'navigation',
    icon: 'far fa-circle-user',
    title: () => trans(`${KEY}.user_menu_label`, 'Menu do usuário do Discourse'),
    description: help(
      'user_menu',
      'O avatar do cabeçalho abre o painel com as abas de notificações, respostas, curtidas, mensagens, marcadores, chat, revisão e perfil (no lugar do sino e do menu da sessão do Flarum).'
    ),
    keywords: 'menu usuário user avatar notificações notifications sino bell painel panel cabeçalho header',
    master: 'canela.user_menu',
  },
  {
    // Chave do recurso de login/cadastro (extend/auth.php): as páginas só
    // existem com as rotas dele carregadas no servidor.
    id: 'auth-pages',
    group: 'navigation',
    icon: 'fas fa-right-to-bracket',
    title: () => trans(`${KEY}.auth.pages_label`, 'Entrar e cadastrar em página própria'),
    description: () =>
      trans(
        `${KEY}.auth.pages_help`,
        'Os botões Entrar e Cadastrar-se do cabeçalho levam às páginas /login e /signup, como no Discourse. Desligada, eles abrem os modais.'
      ),
    keywords: 'entrar login cadastrar cadastro signup sign up registrar página page modal conta account leiaute layout fundo background imagem',
    master: 'canela.auth_pages',
    body: () => (
      <>
        <AdminSelect
          settingKey="canela.auth_layout"
          label={trans(`${KEY}.auth.layout_label`, 'Leiaute')}
          help={trans(
            `${KEY}.auth.layout_help`,
            'Em todos, a página fica sem o cabeçalho, só com o logo do fórum. Com login social, os botões vêm antes do formulário (no do Discourse, ao lado dele).'
          )}
          options={{
            card: trans(`${KEY}.auth.layout_card`, 'Cartão único sobre o fundo (padrão)'),
            discourse: trans(`${KEY}.auth.layout_discourse`, 'Discourse: sem cartão, login social ao lado'),
            split: trans(`${KEY}.auth.layout_split`, 'Tela dividida: painel colorido à esquerda'),
          }}
          default="card"
        />
        {getStr('canela.auth_layout', 'card') === 'split' && (
          <>
            <AdminTextField
              settingKey="canela.auth_split_title"
              label={trans(`${KEY}.auth.split_title_label`, 'Título do painel')}
              help={trans(`${KEY}.auth.split_title_help`, 'Vazio: "Que bom ver você de novo" no login e "Faça parte da comunidade" no cadastro.')}
            />
            <AdminTextField
              settingKey="canela.auth_split_text"
              label={trans(`${KEY}.auth.split_text_label`, 'Texto do painel')}
              help={trans(`${KEY}.auth.split_text_help`, 'Uma ou duas frases abaixo do título. Vazio: o texto padrão de cada página.')}
            />
          </>
        )}
        <BackgroundPicker
          target="auth"
          label={trans(`${KEY}.auth.background_label`, 'Fundo das páginas de entrar e cadastrar')}
          help={trans(
            `${KEY}.auth.background_help`,
            'Na tela dividida, a imagem vai para o painel da esquerda; os outros fundos ficam atrás do formulário.'
          )}
        />
      </>
    ),
    lockedBy: () =>
      getBool('canela.auth_routes_backend')
        ? null
        : trans(
            `${KEY}.shell.auth_backend_off`,
            'As páginas /login e /signup (extend/auth.php) ainda não estão carregadas no servidor: os botões continuam abrindo os modais.'
          ),
  },
  {
    id: 'shortcuts',
    group: 'navigation',
    icon: 'far fa-keyboard',
    title: () => trans(`${KEY}.section_shortcuts`, 'Atalhos de teclado'),
    description: help(
      'keyboard_shortcuts',
      'Os atalhos do Discourse: / busca, c nova discussão, r responder, j e k percorrem a lista, g h volta ao início, = abre ou fecha a barra lateral e ? mostra a lista completa. Não valem enquanto se digita num campo.'
    ),
    keywords: 'atalhos shortcuts teclado keyboard teclas keys hotkeys',
    master: 'canela.keyboard_shortcuts',
  },
  {
    id: 'sidebar',
    group: 'navigation',
    icon: 'fas fa-table-columns',
    title: () => trans(`${KEY}.section_sidebar`, 'Barra lateral'),
    description: help(
      'sidebar_enabled',
      'A coluna à esquerda com a navegação e as tags, como no Discourse. Desligada, o fórum volta à navegação padrão do Flarum.'
    ),
    keywords: 'barra lateral sidebar menu navegação navigation aberta open novo tópico new topic rodapé footer',
    master: 'canela.sidebar_enabled',
    body: () => (
      <>
        {toggle(
          'sidebar_open_default',
          'Começar aberta',
          'Como a barra aparece para quem ainda não a abriu nem fechou pelo botão do cabeçalho. Depois disso vale a escolha de cada visitante, guardada no navegador.'
        )}
        {toggle('sidebar_new_topic', 'Botão "Iniciar Discussão"', 'O botão no topo da barra que abre o editor de uma nova discussão.')}
        {toggle('sidebar_footer', 'Rodapé da barra', 'Os botões no fim da barra: tema claro ou escuro, nova discussão e atalhos de teclado.')}
      </>
    ),
  },
  {
    id: 'sidebar-tags',
    group: 'navigation',
    icon: 'fas fa-tags',
    title: () => trans(`${KEY}.section_sidebar_tags`, 'Tags'),
    keywords: 'categorias categories etiquetas tags barra lateral sidebar limite limit quantidade ponto dot novidades',
    dependsOn: 'canela.sidebar_enabled',
    extensions: TAGS,
    body: () => (
      <>
        {toggle('sidebar_categories', 'Seção Tags', 'As tags primárias, cada uma com a sua cor ou ícone, e o link para todas as tags.')}
        {when(
          'canela.sidebar_categories',
          <AdminSubGroup>
            <AdminToggle
              settingKey="canela.sidebar_category_dots"
              label={trans('ramon-canela.admin.settings.gaps.sidebar_category_dots_label', 'Ponto de novidades nas tags')}
              help={trans(
                'ramon-canela.admin.settings.gaps.sidebar_category_dots_help',
                'Um ponto ao lado de cada tag com discussões novas ou não lidas, como o de "Todas as Discussões".'
              )}
            />
          </AdminSubGroup>
        )}
        <SubDivider />
        {toggle('sidebar_tags', 'Seção Tags secundárias', 'As tags secundárias, com o link para todas as tags.')}
        {when(
          'canela.sidebar_tags',
          <AdminSubGroup>
            {number(
              'sidebar_tags_limit',
              { min: 1, max: 50, fallback: 6 },
              'Tags secundárias na barra',
              'Quantas tags secundárias listar antes do link "Todas as tags", de {min} a {max}.'
            )}
          </AdminSubGroup>
        )}
      </>
    ),
  },

  // ── Lista de tópicos ───────────────────────────────────────────────────────
  {
    id: 'welcome-banner',
    group: 'list',
    icon: 'fas fa-panorama',
    title: () => trans(`${KEY}.section_welcome_banner`, 'Banner de boas-vindas'),
    description: help(
      'welcome_banner',
      'O título e a mensagem de boas-vindas de Aparência num banner sobre o fundo tingido, como no Horizon. Desligado, a página começa direto na lista.'
    ),
    keywords: 'banner boas-vindas welcome hero visitantes guests busca search página inicial home',
    master: 'canela.welcome_banner',
    body: () => (
      <>
        {toggle(
          'welcome_banner_guests_only',
          'Só para visitantes',
          'Quem já entrou na conta vai direto para a lista; o banner fica para quem chega pela primeira vez.'
        )}
        {toggle('welcome_banner_search', 'Campo de busca no banner', 'Uma busca grande no meio do banner, que abre a busca do fórum.')}
      </>
    ),
  },
  {
    id: 'category-hero',
    group: 'list',
    icon: 'fas fa-folder-open',
    title: () => trans(`${KEY}.section_category_hero`, 'Topo da tag'),
    description: help('category_hero', 'Na página de uma tag, um topo com o ícone, a cor, o nome e a descrição dela, antes da lista.'),
    keywords: 'categoria category hero cabeçalho header subcategorias subcategories filhas children cartões cards tags',
    master: 'canela.category_hero',
    extensions: TAGS,
    body: () => toggle('category_hero_children', 'Tags filhas em cartões', 'Abaixo do topo, as tags filhas aparecem como cartões clicáveis.'),
  },
  {
    id: 'list-tabs',
    group: 'list',
    icon: 'fas fa-bars-staggered',
    title: () => trans(`${KEY}.section_nav`, 'Abas da lista'),
    keywords: 'abas tabs navegação navigation não lidas unread em alta hot dias days recentes latest grudar sticky fixa',
    body: () => (
      <>
        {toggle('nav_unread', 'Aba Não lidas', 'As discussões com respostas que a pessoa ainda não leu. Só aparece para quem entrou na conta.')}
        <SubDivider />
        {toggle('nav_hot', 'Aba Em alta', 'As discussões com mais respostas entre as abertas nos últimos dias.')}
        {when(
          'canela.nav_hot',
          <AdminSubGroup>
            {number('hot_days', { min: 1, max: 365, fallback: 7 }, 'Dias contados em Em alta', 'O período considerado, de {min} a {max} dias.')}
          </AdminSubGroup>
        )}
        <SubDivider />
        {toggle(
          'nav_sticky',
          'Abas grudadas no topo',
          'Ao rolar a lista, a barra das abas fica presa embaixo do cabeçalho, como no Horizon. O meta.discourse.org não gruda.'
        )}
      </>
    ),
  },
  {
    id: 'list-filters',
    group: 'list',
    icon: 'fas fa-filter',
    title: () => trans(`${KEY}.section_nav_categories`, 'Filtros por tag'),
    keywords: 'filtros filters menus dropdowns categorias categories etiquetas tags aba tab navegação',
    extensions: TAGS,
    body: () => (
      <>
        {toggle(
          'nav_dropdowns',
          'Menus de tags',
          'Os menus à esquerda das abas, para filtrar a lista por tag primária e por tag secundária, como no Discourse.'
        )}
        {toggle('nav_categories_link', 'Aba Tags', 'Uma aba que leva à página com todas as tags.')}
      </>
    ),
  },
  {
    id: 'list-columns',
    group: 'list',
    icon: 'fas fa-table-list',
    title: () => trans(`${KEY}.section_list_columns`, 'Colunas da lista'),
    keywords:
      'colunas columns cabeçalho header participantes posters avatares avatars visualizações views calor heat contagem resumo excerpt fixados pinned',
    body: () => (
      <>
        {toggle('list_header', 'Cabeçalho das colunas', 'A linha com Discussão, Respostas, Visualizações e Atividade acima da lista.')}
        {toggle(
          'list_posters',
          'Avatares de quem participou',
          'Os avatares do autor e de quem respondeu por último ao lado de cada discussão, como a coluna de participantes do Discourse.'
        )}
        {toggle(
          'list_views',
          'Coluna de visualizações',
          'O número de visualizações de cada discussão, contado pelo card Visualizações de discussão.',
          {
            dependsOn: 'canela.stats_views_enabled',
          }
        )}
        {toggle(
          'list_heat',
          'Destacar contagens altas',
          'Pinta as contagens em laranja ou vermelho quando estão bem acima das demais, como o mapa de calor do Discourse.'
        )}
        {toggle('list_excerpts', 'Resumo das discussões fixadas', 'Abaixo do título, o começo da primeira postagem das discussões fixadas.')}
        <AdminSelect
          settingKey="canela.list_status_icons"
          label={trans(`${KEY}.list_status_icons_label`, 'Ícones antes do título')}
          help={trans(
            `${KEY}.list_status_icons_help`,
            'O alfinete de fixada, a estrela de acompanhando e os demais ícones de situação ao lado do título, na lista e na discussão.'
          )}
          options={{
            muted: trans(`${KEY}.list_status_icons_muted`, 'Atual: em cinza, como o Discourse'),
            colored: trans(`${KEY}.list_status_icons_colored`, 'Colorido: cada ícone com a sua cor'),
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
    title: () => trans(`${KEY}.list_infinite_scroll_label`, 'Rolagem infinita'),
    description: help(
      'list_infinite_scroll',
      'A próxima página da lista carrega sozinha quando o fim chega perto da tela, como no Discourse. Desligada, fica o botão "Carregar mais" do Flarum.'
    ),
    keywords: 'rolagem infinita infinite scroll carregar mais load more paginação pagination',
    master: 'canela.list_infinite_scroll',
  },
  {
    id: 'categories-page',
    group: 'list',
    icon: 'fas fa-table-cells-large',
    title: () => trans(`${KEY}.section_categories_page`, 'Página de tags'),
    keywords: 'categorias categories página page caixas boxes lista list layout tags',
    extensions: TAGS,
    body: () => (
      <AdminSelect
        settingKey="canela.categories_layout"
        label={trans(`${KEY}.categories_layout_label`, 'Formato')}
        help={trans(`${KEY}.categories_layout_help`, 'Como a página de todas as tags as apresenta.')}
        options={{
          boxes: trans(`${KEY}.categories_layout_boxes`, 'Caixas: cartões com a cor, a descrição e as tags filhas'),
          list: trans(`${KEY}.categories_layout_list`, 'Lista: uma tabela de tags com as discussões mais recentes'),
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
    title: () => trans(`${KEY}.section_topic_map`, 'Mapa da discussão'),
    description: help(
      'topic_map',
      'Abaixo da primeira postagem, um resumo com a data de criação, a última resposta, o número de respostas e quem participou.'
    ),
    keywords: 'mapa map resumo summary participantes respostas replies tópico topic',
    master: 'canela.topic_map',
  },
  {
    id: 'topic-timeline',
    group: 'topic',
    icon: 'fas fa-timeline',
    title: () => trans(`${KEY}.section_topic_timeline`, 'Linha do tempo'),
    description: help('topic_timeline', 'A barra à direita que mostra em que ponto da discussão se está e leva a qualquer postagem dela.'),
    keywords: 'linha do tempo timeline rolagem scrubber navegação postagens posts tópico voltar back',
    master: 'canela.topic_timeline',
    body: () => (
      <AdminToggle
        settingKey="canela.timeline_back"
        label={trans('ramon-canela.admin.settings.gaps.timeline_back_label', '"Voltar" na linha do tempo')}
        help={trans(
          'ramon-canela.admin.settings.gaps.timeline_back_help',
          'Quem sobe para longe do ponto até onde já leu vê, no trilho da linha do tempo, o botão que leva de volta à última postagem não lida.'
        )}
      />
    ),
  },
  {
    // O post do Discourse com a linha do tempo do avocado ligando os avatares
    // (less/forum/PostDirect.less, pela classe Canela--postDirect). Vale para
    // todos: a escolha é só do admin.
    id: 'post-style',
    group: 'topic',
    icon: 'fas fa-comments',
    title: () => trans(`${KEY}.post_style_label`, 'Estilo das postagens'),
    keywords:
      'estilo style postagens posts discussão discussion direto direct avocado discourse linha do tempo timeline avatar conversa conversation',
    body: () => (
      <AdminSelect
        settingKey="canela.post_style"
        label={trans(`${KEY}.post_style_label`, 'Estilo das postagens')}
        help={trans(
          `${KEY}.post_style_help`,
          'Com a linha do tempo, os posts continuam iguais aos do Discourse, mas uma linha vertical, como a do tema avocado, liga os avatares de um post ao outro, passa pelos avisos de evento e marca com um círculo os intervalos de tempo ("um mês depois"). A partir do tablet; no celular o post fica igual.'
        )}
        options={{
          discourse: trans(`${KEY}.post_style_discourse`, 'Discourse (padrão)'),
          direct: trans(`${KEY}.post_style_direct`, 'Com a linha do tempo (estilo avocado)'),
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
    title: () => trans(`${KEY}.topic_reply_to_style_label`, '"Em resposta a" nas postagens'),
    keywords: 'em resposta a in reply to resposta reply menção mention cabeçalho header avocado discourse linha line',
    extensions: ['flarum-mentions'],
    body: () => (
      <AdminSelect
        settingKey="canela.topic_reply_to_style"
        label={trans(`${KEY}.topic_reply_to_style_label`, '"Em resposta a" nas postagens')}
        help={trans(
          `${KEY}.topic_reply_to_style_help`,
          'Como a postagem que responde a outra mostra a quem responde. No Discourse, "↩ Fulano" à direita do cabeçalho (só quando a respondida não é a de cima). No avocado, uma linha embaixo do nome, "↳ Em resposta a [avatar] Fulano", em toda resposta. O clique mostra a postagem respondida.'
        )}
        options={{
          discourse: trans(`${KEY}.topic_reply_to_style_discourse`, 'Discourse (padrão: ↩ nome à direita do cabeçalho)'),
          avocado: trans(`${KEY}.topic_reply_to_style_avocado`, 'Linha abaixo do nome (estilo avocado)'),
        }}
        default="discourse"
      />
    ),
  },
  {
    id: 'post-actions',
    group: 'topic',
    icon: 'fas fa-ellipsis',
    title: () => trans(`${KEY}.post_actions_label`, 'Barra de ações do Discourse'),
    description: help(
      'post_actions',
      'Curtir, copiar o link, marcar, responder e o "…" que expande o resto, na barra de cada postagem, como no Discourse. Desligada, volta o menu de controles do Flarum.'
    ),
    keywords: 'ações actions barra bar postagem post curtir like responder reply menu controles controls',
    master: 'canela.post_actions',
  },
  {
    id: 'embedded-replies',
    group: 'topic',
    icon: 'fas fa-reply-all',
    title: () => trans(`${KEY}.embedded_replies_label`, 'Respostas embutidas'),
    description: help(
      'embedded_replies',
      'O "N respostas" de cada postagem abre as respostas ali mesmo, embaixo dela, e a postagem citada aparece acima, como no Discourse.'
    ),
    keywords: 'respostas replies embutidas embedded menções mentions citação quote abaixo inline',
    master: 'canela.embedded_replies',
    extensions: ['flarum-mentions'],
  },
  {
    id: 'new-replies-bar',
    group: 'topic',
    icon: 'fas fa-arrow-down-short-wide',
    title: () => trans(`${KEY}.new_replies_bar_label`, 'Aviso de respostas novas'),
    description: help(
      'new_replies_bar',
      'Quem está no meio da discussão quando chegam respostas em tempo real vê a barra "Há N novas respostas", que leva até elas, como no Discourse.'
    ),
    keywords: 'novas respostas new replies tempo real realtime barra bar aviso websocket',
    master: 'canela.new_replies_bar',
    extensions: ['flarum-realtime'],
  },
  {
    id: 'event-posts',
    group: 'topic',
    icon: 'fas fa-thumbtack',
    title: () => trans(`${KEY}.topic_event_posts_label`, 'Posts de evento'),
    description: help(
      'topic_event_posts',
      'Mostra na discussão os avisos do Flarum como "trancou a discussão" e "fixou a discussão". O Discourse não os mostra assim.'
    ),
    keywords: 'eventos event posts trancou fixou locked pinned renomeou renamed avisos',
    master: 'canela.topic_event_posts',
  },
  {
    id: 'sticky-avatar',
    group: 'topic',
    icon: 'fas fa-user-pen',
    title: () => trans(`${KEY}.topic_sticky_avatar_label`, 'Avatar fixo nos posts'),
    description: help(
      'topic_sticky_avatar',
      'Em posts longos, o avatar do autor acompanha a rolagem e fica visível até o fim do post, como no tema avocado. Só no computador.'
    ),
    keywords: 'avatar fixo sticky acompanha rolagem scroll fixed avatar post longo',
    master: 'canela.topic_sticky_avatar',
  },
  {
    id: 'topic-footer',
    group: 'topic',
    icon: 'fas fa-grip-lines',
    title: () => trans(`${KEY}.section_topic_footer`, 'Rodapé da discussão'),
    description: help(
      'topic_footer',
      'Responder, compartilhar e acompanhar depois da última postagem, como no Discourse. Acompanhar precisa da extensão Subscriptions.'
    ),
    keywords: 'rodapé footer botões buttons responder reply compartilhar share acompanhar follow subscriptions acompanhando notificações',
    master: 'canela.topic_footer',
    body: () =>
      toggle(
        'topic_footer_notifications',
        'Acompanhar no rodapé (computador)',
        'O botão "Acompanhando" e a frase do nível de notificação abaixo dos botões do rodapé. No computador o sino da linha do tempo já faz o mesmo; no celular e no tablet o do rodapé sempre aparece, porque é o único.'
      ),
  },
  {
    id: 'suggested',
    group: 'topic',
    icon: 'far fa-lightbulb',
    title: () => trans(`${KEY}.section_suggested`, 'Discussões sugeridas'),
    description: help(
      'suggested_topics',
      'No fim da discussão, uma lista curta de outras discussões para continuar lendo, de preferência da mesma tag.'
    ),
    keywords: 'sugeridos suggested relacionados related tópicos topics quantidade count',
    master: 'canela.suggested_topics',
    body: () => number('suggested_count', { min: 1, max: 20, fallback: 5 }, 'Quantidade', 'Quantas discussões sugerir, de {min} a {max}.'),
  },

  // ── Perfil e usuários ──────────────────────────────────────────────────────
  {
    id: 'user-page',
    group: 'people',
    icon: 'far fa-id-badge',
    title: () => trans(`${KEY}.section_user_page`, 'Página de perfil'),
    keywords:
      'perfil profile usuário user capa cover estatísticas stats resumo summary aba tab atividade activity lidos read reações reactions votos votes resolvido solved',
    body: () => (
      <>
        {toggle('user_cover', 'Capa no topo do perfil', 'Uma faixa larga atrás do avatar grande e do nome, como no Discourse.')}
        {toggle(
          'user_stats',
          'Estatísticas',
          'Quando entrou, a última visita e os números de postagens e discussões, abaixo do nome. As curtidas só aparecem com a extensão Likes.'
        )}
        {toggle('user_summary', 'Aba Resumo', 'Uma aba inicial com os números do usuário e as suas discussões e respostas de destaque.')}
        {/* Sem a aba Resumo, abrir o perfil nela não tem para onde ir. */}
        {getBool('canela.user_summary') && (
          <AdminSubGroup>
            <AdminSelect
              settingKey="canela.user_default_tab"
              label={trans(`${KEY}.user_default_tab_label`, 'Ao abrir um perfil')}
              help={trans(`${KEY}.user_default_tab_help`, 'Em qual aba o perfil abre quando se clica num avatar ou nome.')}
              options={{
                activity: trans(`${KEY}.user_default_tab_activity`, 'Atividade (postagens), como no Flarum'),
                summary: trans(`${KEY}.user_default_tab_summary`, 'Resumo, como no Discourse'),
              }}
              default="summary"
            />
          </AdminSubGroup>
        )}
        {/* As subabas de "Atividade" do Discourse que dependem de uma extensão (extend/activity.php). */}
        {toggle(
          'user_activity_read',
          'Subaba Lidos',
          'Em Atividade, as discussões que a pessoa leu, da mais recente para a mais antiga. Só a própria pessoa e os administradores a veem.'
        )}
        {toggle(
          'user_activity_reactions',
          'Subaba Reações',
          'Em Atividade, curtidas e reações que a pessoa deu numa lista só, no lugar de Curtidas, com o emoji e o trecho da postagem. As reações só aparecem para quem tem a permissão de ver quem reagiu.',
          { extension: 'fof-reactions' }
        )}
        {toggle(
          'user_activity_votes',
          'Subaba Votos',
          'Em Atividade, as postagens com enquetes em que a pessoa votou. Para os outros, só as enquetes que mostram os votantes.',
          { extension: 'fof-polls' }
        )}
        {toggle('user_activity_solved', 'Subaba Resolvido', 'Em Atividade, as respostas da pessoa escolhidas como melhor resposta.', {
          extension: 'fof-best-answer',
        })}
      </>
    ),
  },
  {
    id: 'user-card',
    group: 'people',
    icon: 'far fa-address-card',
    title: () => trans(`${KEY}.section_user_card`, 'Cartão de usuário'),
    description: help(
      'user_card',
      'Um cartão compacto com a foto, os números e o link para o perfil, aberto pelo avatar ou pelo nome de alguém, sem sair da página.'
    ),
    keywords: 'cartão card usuário user perfil profile avatar nome popup menção mention',
    master: 'canela.user_card',
    body: () => (
      <AdminToggle
        settingKey="canela.mention_cards"
        label={trans('ramon-canela.admin.settings.gaps.mention_cards_label', 'Cartão do usuário nas menções')}
        help={trans(
          'ramon-canela.admin.settings.gaps.mention_cards_help',
          'Clicar numa menção @fulano abre o cartão de usuário em vez de ir ao perfil.'
        )}
      />
    ),
  },
];

export default CORE_CARDS;
