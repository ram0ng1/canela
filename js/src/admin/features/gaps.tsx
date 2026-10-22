/*
 * Cards dos recursos que faltavam (js/src/forum/gaps): o
 * conteúdo das postagens (lightbox, código, títulos, tabelas, spoilers), a
 * leitura no tópico, o título editável, o compartilhar, as datas locais, o
 * "último acesso" e o "Descartar" da lista, o Início e os links extras da
 * barra lateral, e os que têm backend (avisos ao autor, convites, 404). A
 * opção do cartão nas menções mora no card Cartão de usuário (../cards/core),
 * e o "Voltar" da linha do tempo, no card Linha do tempo.
 */
import { AdminNotice, AdminSubGroup, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminSelect from '../components/AdminSelect';
import AdminNumber from '../components/AdminNumber';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';
import AdminTextarea from './AdminTextarea';
import NotFoundPicker from '../components/NotFoundPicker';
import { getBool, getStr, trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.gaps';

const toggle = (name: string, label: string, helpText: string, dependsOn?: string) => (
  <AdminToggle
    settingKey={`canela.${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, helpText)}
    dependsOn={dependsOn}
  />
);

const text = (name: string, label: string, helpText: string, placeholder = '', rows = 1) => (
  <AdminTextarea
    settingKey={`canela.${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, helpText)}
    placeholder={placeholder}
    rows={rows}
  />
);

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

/** Os recursos com backend (extend/gaps.php) só valem com ele carregado no servidor. */
const backendOff = (): string | null =>
  getBool('canela.gaps_backend')
    ? null
    : trans(`${KEY}.backend_off`, 'O backend destes recursos (extend/gaps.php) ainda não está carregado no servidor.');

const cards: CardDef[] = [
  // ── Tópico ─────────────────────────────────────────────────────────────────
  {
    id: 'post-content',
    group: 'topic',
    icon: 'far fa-image',
    title: () => trans(`${KEY}.cooked_title`, 'Conteúdo das postagens'),
    keywords:
      'lightbox imagem image zoom galeria gallery código code copiar copy tela cheia fullscreen âncora anchor título heading tabela table expandir spoiler borrar blur markdown',
    body: () => (
      <>
        {toggle(
          'lightbox',
          'Ampliar imagens (lightbox)',
          'Clicar numa imagem da postagem abre a imagem grande sobre um fundo escuro, com setas entre as imagens da mesma postagem, zoom, "Imagem original" e "Baixar".'
        )}
        {toggle('code_buttons', 'Botões nos blocos de código', 'Ao passar o mouse num bloco de código aparecem "copiar" e "tela cheia".')}
        {toggle(
          'heading_anchors',
          'Link nos títulos',
          'Os títulos dentro das postagens ganham o ícone de link (#) ao passar o mouse, para apontar direto para aquela parte.'
        )}
        {toggle(
          'table_expand',
          'Expandir tabelas largas',
          'Tabelas que não cabem na largura da postagem ganham o botão "Expandir tabela", que as abre numa janela grande.'
        )}
        {toggle(
          'spoiler_blur',
          'Spoilers borrados',
          'Os spoilers (||texto|| e >! no começo da linha) aparecem borrados até o clique, em vez da tarja escura.'
        )}
        {isExtensionEnabled('fof-formatting') && (
          <AdminNotice>{trans(`${KEY}.tables_notice`, 'Tabelas em markdown (| a | b |): ligue o PipeTables no FoF Formatting.')}</AdminNotice>
        )}
      </>
    ),
  },
  {
    id: 'reading',
    group: 'topic',
    icon: 'fas fa-book-open-reader',
    title: () => trans(`${KEY}.reading_title`, 'Leitura e navegação na discussão'),
    keywords: 'lido read não lido unread ponto dot último acesso last visit atalhos shortcuts teclado keyboard j k',
    body: () => (
      <>
        {toggle(
          'post_read_state',
          'Marcas de leitura',
          'O pontinho de "postagem não lida" no canto de cada postagem nova, que some ao ler, e a linha vermelha "último acesso" depois da última postagem lida na visita anterior.'
        )}
        {/* Os atalhos das postagens são parte dos atalhos de teclado: sem eles, somem. */}
        {toggle(
          'post_shortcuts',
          'Atalhos das postagens',
          'j/k andam pelas postagens e l, b, s, e, r, q, d, ! agem sobre a selecionada; # pula para uma postagem; Home/End, shift+L, shift+R, shift+S, shift+P, f, m w/m r/m m e as sequências g n, g u, g b, g m, g d, g j, g k. A janela "?" lista todos.',
          'canela.keyboard_shortcuts'
        )}
      </>
    ),
  },
  {
    id: 'inline-title',
    group: 'topic',
    icon: 'fas fa-pencil',
    title: () => trans(`${KEY}.inline_title_editor_label`, 'Editar o título no cabeçalho'),
    description: help(
      'inline_title_editor',
      'Quem pode renomear vê um lápis ao lado do título da discussão: o título vira um campo, com o botão de tags e ✓/✕ para salvar ou desistir.'
    ),
    keywords: 'título title editar edit lápis pencil renomear rename etiquetas tags categoria category',
    master: 'canela.inline_title_editor',
  },
  {
    id: 'share',
    group: 'topic',
    icon: 'fas fa-share-nodes',
    title: () => trans(`${KEY}.share_modal_label`, 'Janela "Compartilhar discussão"'),
    description: help(
      'share_modal',
      'O botão Compartilhar abre uma janela com o link, o botão de copiar e os botões das redes. Desligado, ele só copia o link. No celular vale a folha de compartilhamento do sistema.'
    ),
    keywords: 'compartilhar share redes social networks x twitter facebook whatsapp telegram linkedin reddit email',
    master: 'canela.share_modal',
    body: () =>
      text(
        'share_networks',
        'Redes',
        'Separadas por vírgula, na ordem em que aparecem: x, facebook, linkedin, whatsapp, telegram, reddit, email.',
        'x,facebook,whatsapp,email'
      ),
  },
  {
    id: 'local-dates',
    group: 'topic',
    icon: 'far fa-calendar',
    title: () => trans(`${KEY}.local_dates_label`, 'Datas locais'),
    description: help(
      'local_dates',
      '[date=2026-10-20 time=14:00 timezone="America/Sao_Paulo"] mostra a data e a hora no fuso de quem lê. Vale depois de limpar o cache.'
    ),
    keywords: 'data date fuso timezone hora time local datas',
    master: 'canela.local_dates',
    lockedBy: backendOff,
  },

  // ── Moderação ──────────────────────────────────────────────────────────────
  {
    id: 'author-notifications',
    group: 'moderation',
    icon: 'fas fa-bell',
    title: () => trans(`${KEY}.notifications_title`, 'Avisos ao autor'),
    keywords: 'notificação notification editou edited vinculou linked autor author moderação',
    lockedBy: backendOff,
    body: () => (
      <>
        {toggle(
          'notify_post_edited',
          'Notificar quando editarem sua postagem',
          '"Fulano editou sua postagem" para o autor, quando outra pessoa (a moderação, por exemplo) muda o texto.'
        )}
        {toggle(
          'notify_topic_linked',
          'Notificar quando vincularem sua discussão',
          '"Fulano vinculou sua discussão" quando uma postagem traz um link para uma discussão sua.'
        )}
      </>
    ),
  },

  // ── Comunidade ─────────────────────────────────────────────────────────────
  {
    id: 'invites',
    group: 'community',
    icon: 'fas fa-user-plus',
    title: () => trans(`${KEY}.invites_enabled_label`, 'Links de convite'),
    description: help(
      'invites_enabled',
      'Quem tem a permissão "Convidar" (Permissões) gera links com validade e número de usos, em Compartilhar e no menu "Mais". Quem entra por um link aparece como convidado e quem convidou recebe "Fulano aceitou seu convite". Precisa do cadastro aberto.'
    ),
    keywords: 'convite invite link cadastro sign up convidar validade',
    master: 'canela.invites_enabled',
    lockedBy: backendOff,
    body: () => (
      <AdminNumber
        settingKey="canela.invites_expire_days"
        label={trans(`${KEY}.invites_expire_days_label`, 'Validade padrão (dias)')}
        help={trans(`${KEY}.invites_expire_days_help`, 'De 1 a 90 dias.')}
        min={1}
        max={90}
        fallback={7}
      />
    ),
  },
  {
    id: 'not-found',
    group: 'community',
    icon: 'far fa-compass',
    title: () => trans(`${KEY}.not_found_page_label`, 'Página 404'),
    description: help(
      'not_found_page',
      '"Oops! Essa página não existe ou é privada.", com "Voltar para o início" e a busca, no lugar da página de erro simples. O modelo escolhido abaixo define o desenho e quais discussões aparecem.'
    ),
    keywords: '404 página não encontrada not found erro error modelo template',
    master: 'canela.not_found_page',
    lockedBy: backendOff,
    body: () => <NotFoundPicker />,
  },

  // ── Lista de tópicos ───────────────────────────────────────────────────────
  {
    id: 'list-visit',
    group: 'list',
    icon: 'fas fa-clock-rotate-left',
    title: () => trans(`${KEY}.list_title`, 'Último acesso e Descartar'),
    keywords: 'último acesso last visit separador separator linha line descartar dismiss novos new não lidos unread marcar lido',
    body: () => (
      <>
        {toggle(
          'list_last_visit',
          'Linha "último acesso"',
          'Na lista de Recentes, uma linha vermelha separa as discussões que mudaram desde a visita anterior das que já estavam assim. A visita anterior fica guardada no aparelho do leitor.'
        )}
        {toggle(
          'list_dismiss',
          'Botão "Descartar"',
          'Nas listas Não lidos e Novos, o botão que marca como lidas as discussões da lista (em cima, à direita, e no fim da lista).'
        )}
      </>
    ),
  },

  // ── Barra lateral ──────────────────────────────────────────────────────────
  {
    id: 'sidebar-home',
    group: 'navigation',
    icon: 'fas fa-house',
    title: () => trans(`${KEY}.sidebar_home_link_label`, 'Link "Início"'),
    description: help(
      'sidebar_home_link',
      'O primeiro link da barra lateral. Quando ele leva à lista de discussões, "Todas as Discussões" passa a abrir a lista de Recentes, para os dois não ficarem marcados juntos.'
    ),
    keywords: 'início home página inicial homepage destino barra lateral sidebar',
    master: 'canela.sidebar_home_link',
    dependsOn: 'canela.sidebar_enabled',
    body: () => (
      <>
        <AdminSelect
          settingKey="canela.sidebar_home"
          label={trans(`${KEY}.sidebar_home_label`, 'Página de destino')}
          options={{
            index: trans(`${KEY}.sidebar_home_index`, 'Lista de discussões (página inicial)'),
            categories: trans(`${KEY}.sidebar_home_categories`, 'Tags'),
            url: trans(`${KEY}.sidebar_home_url_option`, 'Outro endereço'),
          }}
          default="index"
        />
        {getStr('canela.sidebar_home') === 'url' && (
          <AdminSubGroup>
            {text('sidebar_home_url', 'Endereço do Início', 'Um endereço do fórum (/p/boas-vindas) ou de outro site.', '/')}
          </AdminSubGroup>
        )}
      </>
    ),
  },
  {
    id: 'sidebar-links',
    group: 'navigation',
    icon: 'fas fa-link',
    title: () => trans(`${KEY}.sidebar_title`, 'Links extras'),
    description: () =>
      trans(
        `${KEY}.sidebar_help`,
        'Os links de FAQ, termos e privacidade entram no menu "Mais" quando têm endereço. "Revisar" aparece sozinho para a moderação, com a fila de sinalizações.'
      ),
    keywords:
      'links faq perguntas diretrizes guidelines termos terms privacidade privacy seção section personalizada custom mais more revisar review',
    dependsOn: 'canela.sidebar_enabled',
    body: () => (
      <>
        {text('sidebar_faq_url', 'FAQ / Diretrizes', 'Endereço da página de perguntas frequentes ou das diretrizes da comunidade.', 'https://')}
        {text('sidebar_tos_url', 'Termos de serviço', 'Endereço dos termos de serviço.', 'https://')}
        {text('sidebar_privacy_url', 'Privacidade', 'Endereço da política de privacidade.', 'https://')}
        <SubDivider />
        {text('sidebar_custom_title', 'Título da seção personalizada', 'O nome da seção de links (padrão: "Links").', 'Links')}
        {text(
          'sidebar_custom_links',
          'Links da seção personalizada',
          'Um link por linha: Rótulo | endereço | ícone (opcional, do Font Awesome). Endereços que começam com / são do próprio fórum. Sem links, a seção não aparece.',
          'Blog | https://exemplo.com/blog | fas fa-newspaper\nRegras | /p/regras',
          4
        )}
      </>
    ),
  },
];

export default cards;
