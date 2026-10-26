/*
 * Cards das extensões de terceiros: as mensagens privadas (flarum/messages,
 * extend/messages.php) e o visual do tema para as extensões da FoF
 * (js/src/forum/thirdparty). Cada uma só vale com a extensão ligada: sem ela
 * o card fica trancado, com "Precisa da extensão X". As chaves são as
 * `canela.thirdparty_*` do extend.php e a `canela.messages_enabled` do
 * extend/messages.php.
 */
import AdminNumber from '../components/AdminNumber';
import AdminToggle from '../components/AdminToggle';
import { trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.integrations';

const help = (name: string) => () => trans(`${KEY}.${name}_help`);

const ramonToggle = (name: string, dependsOn?: string) => (
  <AdminToggle
    settingKey={`canela.thirdparty_${name}`}
    label={trans(`${KEY}.${name}_label`)}
    help={trans(`${KEY}.${name}_help`)}
    dependsOn={dependsOn}
  />
);

const cards: CardDef[] = [
  // ── Mensagens e chat ───────────────────────────────────────────────────────
  {
    id: 'messages',
    group: 'messages',
    icon: 'far fa-envelope',
    title: () => trans(`${KEY}.messages_label`),
    description: help('messages'),
    keywords: 'mensagens messages privadas private pm md caixa inbox arquivo archive enviadas sent conversa dialog',
    master: 'canela.messages_enabled',
    extensions: ['flarum-messages'],
  },
  {
    id: 'thirdparty-ramon-chat',
    group: 'messages',
    icon: 'far fa-message',
    title: () => trans(`${KEY}.ramon_chat_label`),
    description: help('ramon_chat'),
    keywords: 'chat ramon canais channels mensagens diretas direct messages gaveta drawer fios threads',
    master: 'canela.thirdparty_ramon_chat',
    extensions: ['ramon-chat'],
    body: () => [
      ramonToggle('ramon_chat_sidebar', 'canela.sidebar_enabled'),
      ramonToggle('ramon_chat_notifications'),
      ramonToggle('ramon_chat_user_button'),
    ],
  },

  // ── Integrações ────────────────────────────────────────────────────────────
  {
    id: 'thirdparty-solved',
    group: 'integrations',
    icon: 'far fa-square-check',
    title: () => trans(`${KEY}.solved_label`),
    description: help('solved'),
    keywords: 'solução solved melhor resposta best answer aceita accepted fof',
    master: 'canela.thirdparty_solved',
    extensions: ['fof-best-answer'],
  },
  {
    id: 'thirdparty-reactions',
    group: 'integrations',
    icon: 'far fa-face-smile',
    title: () => trans(`${KEY}.reactions_label`),
    description: help('reactions'),
    keywords: 'reações reactions emoji curtir like fof',
    master: 'canela.thirdparty_reactions',
    extensions: ['fof-reactions'],
  },
  {
    id: 'thirdparty-polls',
    group: 'integrations',
    icon: 'fas fa-square-poll-horizontal',
    title: () => trans(`${KEY}.polls_label`),
    description: help('polls'),
    keywords: 'enquetes polls votação votos votes fof',
    master: 'canela.thirdparty_polls',
    extensions: ['fof-polls'],
  },
  {
    id: 'thirdparty-links',
    group: 'integrations',
    icon: 'fas fa-link',
    title: () => trans(`${KEY}.links_sidebar_label`),
    description: help('links_sidebar'),
    keywords: 'links fof barra lateral sidebar cabeçalho header navegação',
    master: 'canela.thirdparty_links_sidebar',
    dependsOn: 'canela.sidebar_enabled',
    extensions: ['fof-links'],
  },
  {
    id: 'thirdparty-upload',
    group: 'integrations',
    icon: 'fas fa-cloud-arrow-up',
    title: () => trans(`${KEY}.upload_progress_label`),
    description: help('upload_progress'),
    keywords: 'upload envio enviar arquivo file progresso progress barra fof',
    master: 'canela.thirdparty_upload_progress',
    extensions: ['fof-upload'],
  },
  {
    id: 'thirdparty-thumbnails',
    group: 'integrations',
    icon: 'far fa-image',
    title: () => trans(`${KEY}.thumbnails_label`),
    description: help('thumbnails'),
    keywords: 'miniatura thumbnail imagem image lista list tópico fof',
    master: 'canela.thirdparty_thumbnails',
    extensions: ['fof-discussion-thumbnail'],
  },
  {
    id: 'thirdparty-widgets',
    group: 'integrations',
    icon: 'fas fa-table-columns',
    title: () => trans(`${KEY}.widgets_label`),
    description: help('widgets'),
    keywords: 'widgets widget coluna sidebar estatísticas statistics online usuários users html fof',
    master: 'canela.thirdparty_widgets',
    extensions: ['fof-forum-widgets-core'],
    body: () => (
      <AdminNumber
        settingKey="canela.widgets_width"
        label={trans(`${KEY}.widgets_width_label`)}
        help={trans(`${KEY}.widgets_width_help`)}
        min={200}
        max={480}
        fallback={280}
        suffix="px"
      />
    ),
  },
  {
    id: 'thirdparty-profile-cover',
    group: 'integrations',
    icon: 'fas fa-panorama',
    title: () => trans(`${KEY}.profile_cover_label`),
    description: help('profile_cover'),
    keywords: 'capa cover perfil profile imagem image fundo background cartão card forumaker posição position miniatura thumbnail',
    master: 'canela.thirdparty_profile_cover',
    extensions: ['forumaker-profile-cover'],
  },
  {
    id: 'thirdparty-marketplace',
    group: 'integrations',
    icon: 'fas fa-store',
    title: () => trans(`${KEY}.marketplace_label`),
    description: help('marketplace'),
    keywords:
      'loja shop store marketplace produtos products carrinho cart checkout pedidos orders downloads vendedor seller cursos courses planos plans ramon',
    master: 'canela.thirdparty_marketplace',
    extensions: ['ramon-marketplace'],
    body: () => [ramonToggle('marketplace_sidebar', 'canela.sidebar_enabled')],
  },
  {
    id: 'thirdparty-verified',
    group: 'integrations',
    icon: 'fas fa-circle-check',
    title: () => trans(`${KEY}.verified_label`),
    description: help('verified'),
    keywords: 'verificado verified selo badge tick check identidade ramon',
    master: 'canela.thirdparty_verified',
    extensions: ['ramon-verified'],
  },
  {
    id: 'thirdparty-wiki',
    group: 'integrations',
    icon: 'fas fa-book-open',
    title: () => trans(`${KEY}.wiki_label`),
    description: help('wiki'),
    keywords: 'wiki artigos articles documentação docs base de conhecimento knowledge linkrobins',
    master: 'canela.thirdparty_wiki',
    extensions: ['linkrobins-wiki'],
  },
];

export default cards;
