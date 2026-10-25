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

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

const ramonToggle = (name: string, label: string, helpText: string, dependsOn?: string) => (
  <AdminToggle
    settingKey={`canela.thirdparty_${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, helpText)}
    dependsOn={dependsOn}
  />
);

const cards: CardDef[] = [
  // ── Mensagens e chat ───────────────────────────────────────────────────────
  {
    id: 'messages',
    group: 'messages',
    icon: 'far fa-envelope',
    title: () => trans(`${KEY}.messages_label`, 'Mensagens privadas'),
    description: help(
      'messages',
      'Sobre o flarum/messages: as caixas do perfil (Últimos, Enviadas, Novo, Não lidos, Arquivo), o arquivo por pessoa, o título da mensagem, as reações e o "sair da mensagem".'
    ),
    keywords: 'mensagens messages privadas private pm md caixa inbox arquivo archive enviadas sent conversa dialog',
    master: 'canela.messages_enabled',
    extensions: ['flarum-messages'],
  },
  {
    id: 'thirdparty-ramon-chat',
    group: 'messages',
    icon: 'far fa-message',
    title: () => trans(`${KEY}.ramon_chat_label`, 'Chat (ramon/chat) no visual do tema'),
    description: help(
      'ramon_chat',
      'O chat da extensão ramon/chat com a cara do chat do tema: a página sem a segunda coluna, a gaveta, as mensagens, o editor, os fios e as telas de canais. Com ela ligada, o chat do tema dá lugar ao da extensão.'
    ),
    keywords: 'chat ramon canais channels mensagens diretas direct messages gaveta drawer fios threads',
    master: 'canela.thirdparty_ramon_chat',
    extensions: ['ramon-chat'],
    body: () => [
      ramonToggle(
        'ramon_chat_sidebar',
        'Canais na barra lateral',
        'As seções "Canais" e "Mensagens diretas" (com "Meus fios", "Pesquisar" e "Salvos") na barra lateral do tema; a página do chat perde a coluna de canais dela.',
        'canela.sidebar_enabled'
      ),
      ramonToggle(
        'ramon_chat_notifications',
        'Aba "Chat" no menu do usuário',
        'As notificações do chat (convites, menções, moderação) numa aba própria do menu do usuário.'
      ),
      ramonToggle(
        'ramon_chat_user_button',
        'Botão "Chat" no cartão e no perfil',
        'Abrir a conversa direta pelo botão "Chat" no cartão e no perfil, em vez do item no menu "…". Sem efeito com o flarum/messages ligado: aí a conversa privada é a "Mensagem" dele.'
      ),
    ],
  },

  // ── Integrações ────────────────────────────────────────────────────────────
  {
    id: 'thirdparty-solved',
    group: 'integrations',
    icon: 'far fa-square-check',
    title: () => trans(`${KEY}.solved_label`, 'Solução aceita'),
    description: help('solved', 'O "✓ Solução" na barra da postagem e a resposta aceita logo abaixo do primeiro post.'),
    keywords: 'solução solved melhor resposta best answer aceita accepted fof',
    master: 'canela.thirdparty_solved',
    extensions: ['fof-best-answer'],
  },
  {
    id: 'thirdparty-reactions',
    group: 'integrations',
    icon: 'far fa-face-smile',
    title: () => trans(`${KEY}.reactions_label`, 'Reações'),
    description: help('reactions', 'O resumo dos emoji na barra da postagem.'),
    keywords: 'reações reactions emoji curtir like fof',
    master: 'canela.thirdparty_reactions',
    extensions: ['fof-reactions'],
  },
  {
    id: 'thirdparty-polls',
    group: 'integrations',
    icon: 'fas fa-square-poll-horizontal',
    title: () => trans(`${KEY}.polls_label`, 'Enquetes'),
    description: help('polls', 'As enquetes em grade: as barras de resultado e a contagem grande de votos ao lado.'),
    keywords: 'enquetes polls votação votos votes fof',
    master: 'canela.thirdparty_polls',
    extensions: ['fof-polls'],
  },
  {
    id: 'thirdparty-links',
    group: 'integrations',
    icon: 'fas fa-link',
    title: () => trans(`${KEY}.links_sidebar_label`, 'Links na barra lateral'),
    description: help('links_sidebar', 'Os links do FoF Links saem do cabeçalho e vão para uma seção da barra lateral.'),
    keywords: 'links fof barra lateral sidebar cabeçalho header navegação',
    master: 'canela.thirdparty_links_sidebar',
    dependsOn: 'canela.sidebar_enabled',
    extensions: ['fof-links'],
  },
  {
    id: 'thirdparty-upload',
    group: 'integrations',
    icon: 'fas fa-cloud-arrow-up',
    title: () => trans(`${KEY}.upload_progress_label`, 'Progresso do envio'),
    description: help('upload_progress', 'A barra "Enviando…" no editor enquanto um arquivo do FoF Upload sobe.'),
    keywords: 'upload envio enviar arquivo file progresso progress barra fof',
    master: 'canela.thirdparty_upload_progress',
    extensions: ['fof-upload'],
  },
  {
    id: 'thirdparty-thumbnails',
    group: 'integrations',
    icon: 'far fa-image',
    title: () => trans(`${KEY}.thumbnails_label`, 'Miniaturas na lista'),
    description: help('thumbnails', 'A miniatura do FoF Discussion Thumbnail ao lado do título na lista de discussões.'),
    keywords: 'miniatura thumbnail imagem image lista list tópico fof',
    master: 'canela.thirdparty_thumbnails',
    extensions: ['fof-discussion-thumbnail'],
  },
  {
    id: 'thirdparty-widgets',
    group: 'integrations',
    icon: 'fas fa-table-columns',
    title: () => trans(`${KEY}.widgets_label`, 'Widgets (fof/forum-widgets-core)'),
    description: help(
      'widgets',
      'Os widgets da extensão em cartões, como os do tema, numa coluna à direita da lista. Os que ficariam na barra lateral da página (que o tema esconde) entram na mesma coluna. Desligado, ficam com o visual e os lugares da extensão.'
    ),
    keywords: 'widgets widget coluna sidebar estatísticas statistics online usuários users html fof',
    master: 'canela.thirdparty_widgets',
    extensions: ['fof-forum-widgets-core'],
    body: () => (
      <AdminNumber
        settingKey="canela.widgets_width"
        label={trans(`${KEY}.widgets_width_label`, 'Largura da coluna')}
        help={trans(
          `${KEY}.widgets_width_help`,
          'A largura da coluna de widgets ao lado da lista, no computador (de 200 a 480 px). A lista fica com o resto do espaço.'
        )}
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
    title: () => trans(`${KEY}.profile_cover_label`, 'Capa do perfil (forumaker/profile-cover)'),
    description: help(
      'profile_cover',
      'A capa da extensão no lugar da capa interna do tema: na faixa do perfil, no fundo do cartão do usuário (na miniatura, quando existe) e na posição escolhida no editor dela, que abre pelo menu "…" do perfil e pelas Configurações. As imagens internas ficam guardadas e voltam se esta chave for desligada.'
    ),
    keywords: 'capa cover perfil profile imagem image fundo background cartão card forumaker posição position miniatura thumbnail',
    master: 'canela.thirdparty_profile_cover',
    extensions: ['forumaker-profile-cover'],
  },
  {
    id: 'thirdparty-marketplace',
    group: 'integrations',
    icon: 'fas fa-store',
    title: () => trans(`${KEY}.marketplace_label`, 'Loja (ramon/marketplace) no visual do tema'),
    description: help(
      'marketplace',
      'As páginas da loja (vitrine, produto, carrinho, checkout, pedidos, downloads, painel do vendedor, cursos e planos) no cartão do tema, com o título como os heros, os botões, campos, abas e modais do tema, as cores derivadas da cor primária e os ícones Lucide.'
    ),
    keywords:
      'loja shop store marketplace produtos products carrinho cart checkout pedidos orders downloads vendedor seller cursos courses planos plans ramon',
    master: 'canela.thirdparty_marketplace',
    extensions: ['ramon-marketplace'],
    body: () => [
      ramonToggle(
        'marketplace_sidebar',
        'Seção "Loja" na barra lateral',
        'Os links da loja (Marketplace, Carrinho, Pedidos, Downloads, Lista de desejos…) numa seção recolhível da barra lateral, no lugar do menu que abria ao passar o mouse em "Loja".',
        'canela.sidebar_enabled'
      ),
    ],
  },
  {
    id: 'thirdparty-verified',
    group: 'integrations',
    icon: 'fas fa-circle-check',
    title: () => trans(`${KEY}.verified_label`, 'Selo de verificado'),
    description: help(
      'verified',
      'O selo do ramon/verified logo depois do nome, na linha do texto e do tamanho dele: no cabeçalho do post, nos posts embutidos, no "em resposta a", no cartão e no perfil.'
    ),
    keywords: 'verificado verified selo badge tick check identidade ramon',
    master: 'canela.thirdparty_verified',
    extensions: ['ramon-verified'],
  },
  {
    id: 'thirdparty-wiki',
    group: 'integrations',
    icon: 'fas fa-book-open',
    title: () => trans(`${KEY}.wiki_label`, 'Wiki no padrão do tema'),
    description: help(
      'wiki',
      'A wiki da linkrobins/wiki com a cara do tema: o índice como a lista de discussões, o artigo como o primeiro post (com o mapa e o histórico), o composer de discussão para escrever e o link "Wiki" na seção da comunidade da barra lateral.'
    ),
    keywords: 'wiki artigos articles documentação docs base de conhecimento knowledge linkrobins',
    master: 'canela.thirdparty_wiki',
    extensions: ['linkrobins-wiki'],
  },
];

export default cards;
