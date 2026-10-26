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

const toggle = (name: string, dependsOn?: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} dependsOn={dependsOn} />
);

const text = (name: string, placeholder = '', rows = 1) => (
  <AdminTextarea
    settingKey={`canela.${name}`}
    label={trans(`${KEY}.${name}_label`)}
    help={trans(`${KEY}.${name}_help`)}
    placeholder={placeholder}
    rows={rows}
  />
);

const help = (name: string) => () => trans(`${KEY}.${name}_help`);

/** Os recursos com backend (extend/gaps.php) só valem com ele carregado no servidor. */
const backendOff = (): string | null => (getBool('canela.gaps_backend') ? null : trans(`${KEY}.backend_off`));

const cards: CardDef[] = [
  // ── Tópico ─────────────────────────────────────────────────────────────────
  {
    id: 'post-content',
    group: 'topic',
    icon: 'far fa-image',
    title: () => trans(`${KEY}.cooked_title`),
    keywords:
      'lightbox imagem image zoom galeria gallery código code copiar copy tela cheia fullscreen âncora anchor título heading tabela table expandir spoiler borrar blur markdown',
    body: () => (
      <>
        {toggle('lightbox')}
        {toggle('code_buttons')}
        {toggle('heading_anchors')}
        {toggle('table_expand')}
        {toggle('spoiler_blur')}
        {isExtensionEnabled('fof-formatting') && <AdminNotice>{trans(`${KEY}.tables_notice`)}</AdminNotice>}
      </>
    ),
  },
  {
    id: 'reading',
    group: 'topic',
    icon: 'fas fa-book-open-reader',
    title: () => trans(`${KEY}.reading_title`),
    keywords: 'lido read não lido unread ponto dot último acesso last visit atalhos shortcuts teclado keyboard j k',
    body: () => (
      <>
        {toggle('post_read_state')}
        {/* Os atalhos das postagens são parte dos atalhos de teclado: sem eles, somem. */}
        {toggle('post_shortcuts', 'canela.keyboard_shortcuts')}
      </>
    ),
  },
  {
    id: 'inline-title',
    group: 'topic',
    icon: 'fas fa-pencil',
    title: () => trans(`${KEY}.inline_title_editor_label`),
    description: help('inline_title_editor'),
    keywords: 'título title editar edit lápis pencil renomear rename etiquetas tags categoria category',
    master: 'canela.inline_title_editor',
  },
  {
    id: 'share',
    group: 'topic',
    icon: 'fas fa-share-nodes',
    title: () => trans(`${KEY}.share_modal_label`),
    description: help('share_modal'),
    keywords: 'compartilhar share redes social networks x twitter facebook whatsapp telegram linkedin reddit email',
    master: 'canela.share_modal',
    body: () => text('share_networks', 'x,facebook,whatsapp,email'),
  },
  {
    id: 'local-dates',
    group: 'topic',
    icon: 'far fa-calendar',
    title: () => trans(`${KEY}.local_dates_label`),
    description: help('local_dates'),
    keywords: 'data date fuso timezone hora time local datas',
    master: 'canela.local_dates',
    lockedBy: backendOff,
  },

  // ── Moderação ──────────────────────────────────────────────────────────────
  {
    id: 'author-notifications',
    group: 'moderation',
    icon: 'fas fa-bell',
    title: () => trans(`${KEY}.notifications_title`),
    keywords: 'notificação notification editou edited vinculou linked autor author moderação',
    lockedBy: backendOff,
    body: () => (
      <>
        {toggle('notify_post_edited')}
        {toggle('notify_topic_linked')}
      </>
    ),
  },

  // ── Comunidade ─────────────────────────────────────────────────────────────
  {
    id: 'invites',
    group: 'community',
    icon: 'fas fa-user-plus',
    title: () => trans(`${KEY}.invites_enabled_label`),
    description: help('invites_enabled'),
    keywords: 'convite invite link cadastro sign up convidar validade',
    master: 'canela.invites_enabled',
    lockedBy: backendOff,
    body: () => (
      <AdminNumber
        settingKey="canela.invites_expire_days"
        label={trans(`${KEY}.invites_expire_days_label`)}
        help={trans(`${KEY}.invites_expire_days_help`)}
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
    title: () => trans(`${KEY}.not_found_page_label`),
    description: help('not_found_page'),
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
    title: () => trans(`${KEY}.list_title`),
    keywords: 'último acesso last visit separador separator linha line descartar dismiss novos new não lidos unread marcar lido',
    body: () => (
      <>
        {toggle('list_last_visit')}
        {toggle('list_dismiss')}
      </>
    ),
  },

  // ── Barra lateral ──────────────────────────────────────────────────────────
  {
    id: 'sidebar-home',
    group: 'navigation',
    icon: 'fas fa-house',
    title: () => trans(`${KEY}.sidebar_home_link_label`),
    description: help('sidebar_home_link'),
    keywords: 'início home página inicial homepage destino barra lateral sidebar',
    master: 'canela.sidebar_home_link',
    dependsOn: 'canela.sidebar_enabled',
    body: () => (
      <>
        <AdminSelect
          settingKey="canela.sidebar_home"
          label={trans(`${KEY}.sidebar_home_label`)}
          options={{
            index: trans(`${KEY}.sidebar_home_index`),
            categories: trans(`${KEY}.sidebar_home_categories`),
            url: trans(`${KEY}.sidebar_home_url_option`),
          }}
          default="index"
        />
        {getStr('canela.sidebar_home') === 'url' && <AdminSubGroup>{text('sidebar_home_url', '/')}</AdminSubGroup>}
      </>
    ),
  },
  {
    id: 'sidebar-links',
    group: 'navigation',
    icon: 'fas fa-link',
    title: () => trans(`${KEY}.sidebar_title`),
    description: () => trans(`${KEY}.sidebar_help`),
    keywords:
      'links faq perguntas diretrizes guidelines termos terms privacidade privacy seção section personalizada custom mais more revisar review',
    dependsOn: 'canela.sidebar_enabled',
    body: () => (
      <>
        {text('sidebar_faq_url', 'https://')}
        {text('sidebar_tos_url', 'https://')}
        {text('sidebar_privacy_url', 'https://')}
        <SubDivider />
        {text('sidebar_custom_title', 'Links')}
        {text('sidebar_custom_links', 'Blog | https://exemplo.com/blog | fas fa-newspaper\nRegras | /p/regras', 4)}
      </>
    ),
  },
];

export default cards;
