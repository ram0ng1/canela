<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela;

use Flarum\Extend;
use Ramon\Canela\Theme\FontFamily;
use Ramon\Canela\Theme\Loader\LoaderAdminPayload;
use Ramon\Canela\Theme\Loader\LoaderLess;
use Ramon\Canela\Theme\Loader\LoaderPresets;
use Ramon\Canela\Theme\Loader\SanitizeLoaderSetting;
use Ramon\Canela\Theme\Logo\SvgLogoServiceProvider;
use Ramon\Canela\Support\RouteConflictGuard;

/*
 * Cada configuração do tema: chave => [atributo no fórum, padrão, conversão].
 *
 * Uma tabela só porque as três listas (padrões, serializeToForum e o admin)
 * precisam andar juntas — uma chave esquecida em uma delas não dá erro, só
 * faz a opção sumir em silêncio.
 */
$forumSettings = [
    // Aparência
    'canela.tinted_background' => ['canelaTintedBackground', true, 'boolval'],
    'canela.colored_accents' => ['canelaColoredAccents', true, 'boolval'],
    'canela.logo_colored' => ['canelaLogoColored', false, 'boolval'],
    'canela.content_card' => ['canelaContentCard', true, 'boolval'],
    'canela.show_title_with_logo' => ['canelaShowTitleWithLogo', false, 'boolval'],
    'canela.pill_buttons' => ['canelaPillButtons', true, 'boolval'],
    'canela.lucide_icons' => ['canelaLucideIcons', true, 'boolval'],

    // Páginas de entrar e cadastrar (features/auth): o leiaute — card (cartão
    // único, o padrão), discourse (sem cartão, duas colunas) ou split (tela
    // dividida, com o painel colorido).
    'canela.auth_layout' => ['canelaAuthLayout', 'card', null],
    // Os textos de cada página (vazios: os padrões do Flarum e do tema).
    'canela.auth_login_title' => ['canelaAuthLoginTitle', '', null],
    'canela.auth_login_subtitle' => ['canelaAuthLoginSubtitle', '', null],
    'canela.auth_signup_title' => ['canelaAuthSignupTitle', '', null],
    'canela.auth_signup_subtitle' => ['canelaAuthSignupSubtitle', '', null],
    'canela.auth_panel_login_title' => ['canelaAuthPanelLoginTitle', '', null],
    'canela.auth_panel_login_text' => ['canelaAuthPanelLoginText', '', null],
    'canela.auth_panel_signup_title' => ['canelaAuthPanelSignupTitle', '', null],
    'canela.auth_panel_signup_text' => ['canelaAuthPanelSignupText', '', null],

    // Barra lateral
    'canela.sidebar_enabled' => ['canelaSidebarEnabled', true, 'boolval'],
    'canela.sidebar_open_default' => ['canelaSidebarOpenDefault', true, 'boolval'],
    'canela.sidebar_new_topic' => ['canelaSidebarNewTopic', true, 'boolval'],
    'canela.sidebar_categories' => ['canelaSidebarCategories', true, 'boolval'],
    'canela.sidebar_tags' => ['canelaSidebarTags', true, 'boolval'],
    'canela.sidebar_tags_limit' => ['canelaSidebarTagsLimit', 6, 'intval'],
    'canela.sidebar_footer' => ['canelaSidebarFooter', true, 'boolval'],

    // Cabeçalho
    'canela.header_search' => ['canelaHeaderSearch', true, 'boolval'],

    // Atalhos
    'canela.keyboard_shortcuts' => ['canelaKeyboardShortcuts', true, 'boolval'],
    'canela.loading_slider' => ['canelaLoadingSlider', true, 'boolval'],
    'canela.toast_auto_close' => ['canelaToastAutoClose', true, 'boolval'],

    // Página inicial
    'canela.welcome_banner' => ['canelaWelcomeBanner', false, 'boolval'],
    'canela.welcome_banner_guests_only' => ['canelaWelcomeBannerGuestsOnly', false, 'boolval'],
    'canela.welcome_banner_search' => ['canelaWelcomeBannerSearch', true, 'boolval'],
    'canela.category_hero' => ['canelaCategoryHero', true, 'boolval'],
    'canela.category_hero_children' => ['canelaCategoryHeroChildren', true, 'boolval'],

    // Navegação da lista
    'canela.nav_hot' => ['canelaNavHot', true, 'boolval'],
    'canela.hot_days' => ['canelaHotDays', 7, 'intval'],
    'canela.nav_unread' => ['canelaNavUnread', true, 'boolval'],
    'canela.nav_categories_link' => ['canelaNavCategoriesLink', true, 'boolval'],
    'canela.nav_dropdowns' => ['canelaNavDropdowns', true, 'boolval'],
    'canela.nav_sticky' => ['canelaNavSticky', false, 'boolval'],
    'canela.list_infinite_scroll' => ['canelaListInfiniteScroll', true, 'boolval'],

    // Lista de tópicos
    'canela.list_header' => ['canelaListHeader', true, 'boolval'],
    'canela.list_posters' => ['canelaListPosters', true, 'boolval'],
    'canela.list_views' => ['canelaListViews', true, 'boolval'],
    'canela.list_heat' => ['canelaListHeat', true, 'boolval'],
    'canela.list_excerpts' => ['canelaListExcerpts', true, 'boolval'],
    'canela.list_status_icons' => ['canelaListStatusIcons', 'muted', null],

    // Página de categorias
    'canela.categories_layout' => ['canelaCategoriesLayout', 'boxes', null],

    // Tópico
    'canela.topic_map' => ['canelaTopicMap', true, 'boolval'],
    'canela.topic_event_posts' => ['canelaTopicEventPosts', true, 'boolval'],
    // O avatar acompanha a rolagem nos posts longos (como o "fixedAvatar" do avocado).
    'canela.topic_sticky_avatar' => ['canelaTopicStickyAvatar', false, 'boolval'],
    // Largura máxima do cartão de conteúdo (px); aplicada antes da pintura no PreBootShell.
    'canela.content_width' => ['canelaContentWidth', '1110', 'strval'],
    'canela.topic_timeline' => ['canelaTopicTimeline', true, 'boolval'],
    'canela.topic_footer' => ['canelaTopicFooter', true, 'boolval'],
    // O "Acompanhando ▾" do rodapé no computador, onde o sino da linha do
    // tempo já faz o mesmo (no celular e no tablet ele sempre aparece).
    'canela.topic_footer_notifications' => ['canelaTopicFooterNotifications', false, 'boolval'],
    'canela.suggested_topics' => ['canelaSuggestedTopics', true, 'boolval'],
    'canela.suggested_count' => ['canelaSuggestedCount', 5, 'intval'],
    'canela.user_card' => ['canelaUserCard', true, 'boolval'],
    'canela.user_menu' => ['canelaUserMenu', true, 'boolval'],
    'canela.post_actions' => ['canelaPostActions', true, 'boolval'],
    'canela.embedded_replies' => ['canelaEmbeddedReplies', true, 'boolval'],
    'canela.new_replies_bar' => ['canelaNewRepliesBar', true, 'boolval'],
    // Estilo das postagens: 'discourse' (padrão) ou 'direct' (o mesmo post com
    // a linha do tempo do avocado ligando os avatares: less/forum/PostDirect.less).
    'canela.post_style' => ['canelaPostStyle', 'discourse', null],
    // O "em resposta a" do post: 'discourse' (↩ nome à direita do cabeçalho)
    // ou 'avocado' (uma linha embaixo do nome: "↳ Em resposta a [avatar] Fulano").
    'canela.topic_reply_to_style' => ['canelaTopicReplyToStyle', 'discourse', null],

    // Extensões de terceiros (visual do Discourse)
    'canela.thirdparty_solved' => ['canelaThirdPartySolved', true, 'boolval'],
    'canela.thirdparty_reactions' => ['canelaThirdPartyReactions', true, 'boolval'],
    'canela.thirdparty_polls' => ['canelaThirdPartyPolls', true, 'boolval'],
    'canela.thirdparty_links_sidebar' => ['canelaThirdPartyLinksSidebar', true, 'boolval'],
    'canela.thirdparty_upload_progress' => ['canelaThirdPartyUploadProgress', true, 'boolval'],
    'canela.thirdparty_thumbnails' => ['canelaThirdPartyThumbnails', true, 'boolval'],
    // forumaker/profile-cover no lugar da capa interna (thirdparty/profileCover).
    'canela.thirdparty_profile_cover' => ['canelaThirdPartyProfileCover', true, 'boolval'],
    // ramon/verified: o selo depois do nome, na linha do texto (thirdparty/verified).
    'canela.thirdparty_verified' => ['canelaThirdPartyVerified', true, 'boolval'],
    // linkrobins/wiki no padrão do tema (thirdparty/wiki): índice, artigo,
    // edição e o "Wiki" da barra lateral.
    'canela.thirdparty_wiki' => ['canelaThirdPartyWiki', true, 'boolval'],
    // ramon/chat no visual do chat do Discourse (thirdparty/ramonChat): a chave
    // geral, as seções da barra lateral, a aba do menu e o botão do cartão.
    'canela.thirdparty_ramon_chat' => ['canelaThirdPartyRamonChat', true, 'boolval'],
    'canela.thirdparty_ramon_chat_sidebar' => ['canelaThirdPartyRamonChatSidebar', true, 'boolval'],
    'canela.thirdparty_ramon_chat_notifications' => ['canelaThirdPartyRamonChatNotifications', true, 'boolval'],
    'canela.thirdparty_ramon_chat_user_button' => ['canelaThirdPartyRamonChatUserButton', true, 'boolval'],
    // ramon/marketplace no visual do tema (thirdparty/marketplace): a chave
    // geral e a seção "Loja" da barra lateral.
    'canela.thirdparty_marketplace' => ['canelaThirdPartyMarketplace', true, 'boolval'],
    'canela.thirdparty_marketplace_sidebar' => ['canelaThirdPartyMarketplaceSidebar', true, 'boolval'],

    // Perfil
    'canela.user_cover' => ['canelaUserCover', true, 'boolval'],
    'canela.user_stats' => ['canelaUserStats', true, 'boolval'],
    'canela.user_summary' => ['canelaUserSummary', true, 'boolval'],
    'canela.user_default_tab' => ['canelaUserDefaultTab', 'summary', null],
    // Subabas de "Atividade" (extend/activity.php), cada uma com a sua extensão.
    'canela.user_activity_read' => ['canelaUserActivityRead', true, 'boolval'],
    'canela.user_activity_reactions' => ['canelaUserActivityReactions', true, 'boolval'],
    'canela.user_activity_votes' => ['canelaUserActivityVotes', true, 'boolval'],
    'canela.user_activity_solved' => ['canelaUserActivitySolved', true, 'boolval'],

    // Recursos do Discourse que faltavam (js/src/forum/gaps)
    'canela.post_shortcuts' => ['canelaPostShortcuts', true, 'boolval'],
    'canela.lightbox' => ['canelaLightbox', true, 'boolval'],
    'canela.code_buttons' => ['canelaCodeButtons', true, 'boolval'],
    'canela.heading_anchors' => ['canelaHeadingAnchors', true, 'boolval'],
    'canela.table_expand' => ['canelaTableExpand', true, 'boolval'],
    'canela.spoiler_blur' => ['canelaSpoilerBlur', true, 'boolval'],
    'canela.mention_cards' => ['canelaMentionCards', true, 'boolval'],
    'canela.post_read_state' => ['canelaPostReadState', true, 'boolval'],
    'canela.timeline_back' => ['canelaTimelineBack', true, 'boolval'],
    'canela.inline_title_editor' => ['canelaInlineTitleEditor', true, 'boolval'],
    'canela.share_modal' => ['canelaShareModal', true, 'boolval'],
    'canela.share_networks' => ['canelaShareNetworks', 'x,facebook,whatsapp,email', null],
    'canela.list_last_visit' => ['canelaListLastVisit', true, 'boolval'],
    'canela.list_dismiss' => ['canelaListDismiss', true, 'boolval'],
    'canela.sidebar_faq_url' => ['canelaSidebarFaqUrl', '', null],
    'canela.sidebar_tos_url' => ['canelaSidebarTosUrl', '', null],
    'canela.sidebar_privacy_url' => ['canelaSidebarPrivacyUrl', '', null],
    'canela.sidebar_custom_title' => ['canelaSidebarCustomTitle', '', null],
    'canela.sidebar_custom_links' => ['canelaSidebarCustomLinks', '', null],
    'canela.sidebar_home_link' => ['canelaSidebarHomeLink', true, 'boolval'],
    'canela.sidebar_home' => ['canelaSidebarHome', 'index', null],
    'canela.sidebar_home_url' => ['canelaSidebarHomeUrl', '', null],
    'canela.sidebar_category_dots' => ['canelaSidebarCategoryDots', true, 'boolval'],

    // Entrar e cadastrar: páginas próprias (/login, /signup) ou os modais do core.
    'canela.auth_pages' => ['canelaAuthPages', true, 'boolval'],
    // Os modais de entrar/cadastro abertos de qualquer lugar também viram as páginas.
    'canela.auth_pages_modals' => ['canelaAuthPagesModals', true, 'boolval'],
];

// As cores não têm configuração própria: o tema deriva a paleta inteira da cor
// primária do Flarum (Aparência), como o Horizon do Discourse faz com a
// "tertiary". Só a fonte vira variável do LESS — e o default dela mora aqui,
// não no LESS: as variáveis de config entram antes das folhas das extensões, e
// um default declarado na folha sobrescreveria o valor escolhido no admin.
$settings = (new Extend\Settings())
    ->default(FontFamily::SETTING, FontFamily::INTER)
    ->registerLessConfigVar('config-canela-font', FontFamily::SETTING, FontFamily::class)
    // O CSS do chat e da IA (less/forum/features/Chat.less e Ai.less) só entra
    // com o recurso ligado; mudar a opção no admin recompila a folha. Sem valor
    // gravado, vale o padrão dos dois recursos (ligado).
    // Com o ramon/chat habilitado o chat do tema dá lugar a ele (ver $yieldsTo).
    ->registerLessConfigVar('config-canela-chat', 'canela.chat_enabled', static fn ($value): string => (bool) $value && ! resolve(\Flarum\Extension\ExtensionManager::class)->isEnabled('ramon-chat') ? 'true' : 'false')
    // O visual do ramon/chat (less/forum/thirdparty/RamonChat.less): só com a
    // extensão habilitada e a integração ligada no admin (padrão: ligada).
    ->registerLessConfigVar('config-ramon-chat', 'canela.thirdparty_ramon_chat', static fn ($value): string => ($value === null || (bool) $value) && resolve(\Flarum\Extension\ExtensionManager::class)->isEnabled('ramon-chat') ? 'true' : 'false')
    // O visual do ramon/marketplace (less/forum/thirdparty/Marketplace.less),
    // nas mesmas condições: extensão habilitada e integração ligada.
    ->registerLessConfigVar('config-ramon-marketplace', 'canela.thirdparty_marketplace', static fn ($value): string => ($value === null || (bool) $value) && resolve(\Flarum\Extension\ExtensionManager::class)->isEnabled('ramon-marketplace') ? 'true' : 'false')
    // O visual da linkrobins/wiki (less/forum/thirdparty/Wiki.less): só com a
    // extensão habilitada e a integração ligada no admin (padrão: ligada).
    ->registerLessConfigVar('config-canela-wiki', 'canela.thirdparty_wiki', static fn ($value): string => ($value === null || (bool) $value) && resolve(\Flarum\Extension\ExtensionManager::class)->isEnabled('linkrobins-wiki') ? 'true' : 'false')
    ->registerLessConfigVar('config-canela-ai', 'canela.ai_enabled', static fn ($value): string => $value === null || (bool) $value ? 'true' : 'false')
    // Indicador de carregamento com SVG (less/forum/Loader.less): o desenho vai
    // na folha como `data:`, e cada uma das chaves recompila a folha ao mudar.
    // Os valores saem de LoaderLess, que devolve o padrão do Flarum se algo
    // estiver fora do esperado (um valor quebrado derrubaria a folha inteira).
    ->default(LoaderLess::STYLE, LoaderPresets::DEFAULT)
    ->default(LoaderLess::CUSTOM, '')
    ->default(LoaderLess::TINT, true)
    ->default(LoaderLess::COLOR, '')
    ->default(LoaderLess::SIZE, 100)
    ->registerLessConfigVar('config-canela-loader-on', LoaderLess::STYLE, static fn ($value): string => LoaderLess::on($value))
    ->registerLessConfigVar('config-canela-loader-image', LoaderLess::CUSTOM, static fn (): string => LoaderLess::image())
    ->registerLessConfigVar('config-canela-loader-still', LoaderLess::CUSTOM, static fn (): string => LoaderLess::still())
    ->registerLessConfigVar('config-canela-loader-tint', LoaderLess::TINT, static fn ($value): string => LoaderLess::tint($value))
    ->registerLessConfigVar('config-canela-loader-color', LoaderLess::COLOR, static fn ($value): string => LoaderLess::color($value))
    ->registerLessConfigVar('config-canela-loader-scale', LoaderLess::SIZE, static fn ($value): string => LoaderLess::scale($value));

// As folhas das extensões de terceiros (less/forum/thirdparty/*) só entram
// com a extensão habilitada: habilitar ou desabilitar uma extensão já
// recompila a folha. A chave não existe; só o nome da extensão decide.
foreach ([
    'config-canela-tp-links' => ['fof-links'],
    'config-canela-tp-follow-tags' => ['fof-follow-tags'],
    'config-canela-tp-upload' => ['fof-upload'],
    'config-canela-tp-oauth' => ['fof-oauth'],
    'config-canela-tp-terms' => ['fof-terms'],
    'config-canela-tp-formatting' => ['fof-formatting'],
    'config-canela-tp-thumbnails' => ['fof-discussion-thumbnail'],
    'config-canela-tp-moderation' => ['fof-split', 'fof-merge-discussions', 'fof-ignore-users'],
    'config-canela-tp-verified' => ['ramon-verified'],
    'config-canela-tp-profile-cover' => ['forumaker-profile-cover'],
] as $var => $extensions) {
    $settings->registerLessConfigVar($var, 'canela.thirdparty_less', static function () use ($extensions): string {
        $manager = resolve(\Flarum\Extension\ExtensionManager::class);

        foreach ($extensions as $id) {
            if ($manager->isEnabled($id)) {
                return 'true';
            }
        }

        return 'false';
    });
}

foreach ($forumSettings as $key => [$attributeName, $default, $cast]) {
    $settings->default($key, $default)->serializeToForum($attributeName, $key, $cast);
}

/*
 * Os recursos com backend (marcadores, visualizações, emblemas, diretório…)
 * moram cada um em extend/<recurso>.php, que devolve a própria lista de
 * extenders. Assim cada recurso fica inteiro num lugar, e o tema base não
 * precisa saber deles.
 */
$features = [];

// O require roda numa closure estática para cada arquivo ter o próprio escopo:
// direto aqui, um `$settings = …` num recurso sobrescreveria o `$settings` do
// tema base, que então seria registrado duas vezes (e perderia os padrões).
$requireFeature = static fn (string $file): array => require $file;

// Só carregam os recursos listados em extend/.enabled (um por linha): um
// recurso novo entra na lista depois de testado, e o fórum nunca cai por causa
// de um que ainda está em construção.
//
// Para testar um recurso sem afetar quem usa o site, a requisição manda o
// cabeçalho `X-Canela-Probe: <recurso>[,<recurso>…]`, que vale só para ela.
$readList = static fn (string $text): array => array_values(array_filter(array_map('trim', preg_split('/[\s,]+/', $text) ?: [])));
$enabledFile = __DIR__.'/extend/.enabled';
$enabled = is_file($enabledFile) ? $readList((string) file_get_contents($enabledFile)) : [];

if (isset($_SERVER['HTTP_X_CANELA_PROBE'])) {
    $enabled = $readList((string) $_SERVER['HTTP_X_CANELA_PROBE']);
}

$featureFiles = array_filter(
    glob(__DIR__.'/extend/*.php') ?: [],
    static fn (string $file): bool => in_array(basename($file, '.php'), $enabled, true)
);

// Recursos que dão lugar a uma extensão própria com o mesmo papel: com ela
// habilitada, o do tema nem registra rotas, API ou configurações (e o tema
// adapta a extensão, em thirdparty/). Duas rotas /chat derrubariam o boot.
$yieldsTo = [
    'chat' => 'ramon-chat',
];

foreach ($featureFiles as $featureFile) {
    $feature = basename($featureFile, '.php');

    if (isset($yieldsTo[$feature])) {
        $features[] = (new Extend\Conditional())->whenExtensionDisabled(
            $yieldsTo[$feature],
            static function () use ($requireFeature, $featureFile, $feature): array {
                try {
                    return $requireFeature($featureFile);
                } catch (\Throwable $error) {
                    error_log(sprintf('[ramon/canela] recurso %s desligado: %s', $feature, $error->getMessage()));

                    return [];
                }
            }
        );

        continue;
    }

    // Um recurso que falha ao carregar fica de fora, e o fórum continua no ar
    // com o resto: melhor um recurso a menos do que um erro 500 no site todo.
    try {
        $features = array_merge($features, $requireFeature($featureFile));
    } catch (\Throwable $error) {
        error_log(sprintf('[ramon/canela] recurso %s desligado: %s', basename($featureFile), $error->getMessage()));
    }
}

return [
    ...$features,

    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        // Os chunks carregados sob demanda (páginas, modais): sem o diretório
        // registrado, o import() não teria de onde baixar o arquivo.
        ->jsDirectory(__DIR__.'/js/dist/forum')
        ->css(__DIR__.'/less/forum.less')
        // Com os ícones do Lucide (o padrão), o `far` (fa-regular, 20 KB) só
        // desenha o ícone de copiar dos blocos de código; o core o pré-carrega
        // em toda página. Sem o preload a fonte desce quando o ícone aparece.
        // O fa-solid continua: ícones de tag/grupo e do wardrobe o usam em toda
        // página. Roda depois do conteúdo do core (prioridade 160), que os põe.
        ->content(static function (\Flarum\Frontend\Document $document): void {
            $lucide = resolve(\Flarum\Settings\SettingsRepositoryInterface::class)->get('canela.lucide_icons');

            if ($lucide !== null && ! (bool) $lucide) {
                return;
            }

            $document->preloads = array_values(array_filter(
                $document->preloads,
                static fn (array $preload): bool => ! preg_match('#/fonts/fa-regular-400\.woff2#', (string) ($preload['href'] ?? ''))
            ));
        }),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        // O painel do tema é um chunk (js/src/admin/panel.tsx).
        ->jsDirectory(__DIR__.'/js/dist/admin')
        ->css(__DIR__.'/less/admin.less')
        // A prévia dos indicadores de carregamento prontos no card do admin.
        ->content(LoaderAdminPayload::class),

    new Extend\Locales(__DIR__.'/locale'),

    // O campo de logo padrão do Flarum aceita SVG (limpo antes de salvar).
    (new Extend\ServiceProvider())->register(SvgLogoServiceProvider::class),

    // O SVG próprio do indicador de carregamento é limpo antes de ir ao banco.
    (new Extend\Event())->listen(\Flarum\Settings\Event\Saving::class, SanitizeLoaderSetting::class),

    // Rota do tema que outra extensão já ocupa (/chat, /search…) sai, em vez
    // de derrubar o fórum com BadRouteException.
    (new Extend\ServiceProvider())->register(RouteConflictGuard::class),

    // Wardrobe: só o tema padrão é aquecido a cada recompilação (ver LazyThemeAssets).
    (new Extend\Conditional())->whenExtensionEnabled('ernestdefoe-wardrobe', static fn (): array => [
        (new Extend\ServiceProvider())->register(\Ramon\Canela\Support\WardrobeServiceProvider::class),
    ]),

    $settings,
];
