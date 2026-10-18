
## Iteração 1 — segurança e backend (PHP)

### Auditoria de exposição (visitante via curl, usuário 2 via API interna em transação desfeita)

Testado e **sem vazamento**: atributos do fórum (nenhuma chave de IA/API; `canelaAi` é null sem provedor e sem chave), `/api/users/:id` (e-mail, preferências, `canelaDialogCounts`, data completa do aniversário e `canelaBirthdayShowYear` só para o próprio usuário/editor; o ano só sai se a pessoa escolheu mostrar), mensagens privadas (`/dialogs`, `/dialog-messages`, reagir, ver reações, marcar lida/não lida, sair, convidar, arquivar: 404 para quem não participa), marcadores (401 visitante, 404 de outro usuário em show/patch/delete), convites (só os próprios), conceder emblema/recalcular (403), revisões (respeitam a visibilidade do post e escondem o conteúdo de post oculto), Me too / contagens / tempo de leitura (exigem login, verificam visibilidade do tópico, têm limite de taxa), clique em link (só URL presente no post visível, dedupe e limite por pessoa/IP), diretório (403 sem permissão), atividade de grupo (escopo de grupos ocultos), IA (gate de recurso/usuário/cota; teste de conexão só admin), chat (desligado: 404). Preload (`canelaPreload`) roda cada pedido como o próprio ator. `m.trust` só recebe HTML do formatador do Flarum/BioRenderer ou do admin. O sanitizador do logo SVG remove script/foreignObject/on*/href externos/`@import`.

Nenhum achado de gravidade alta ou média. Observações (paridade com o Discourse, mantidas): estatísticas de leitura e o resumo do perfil são públicos; as visualizações por dia do tópico aparecem para quem vê o tópico.

### Desempenho

- **Conferências de esquema em toda requisição** (achado principal): Capabilities (emblemas), MessagesSchema, MessageReactions, DialogEvents, InviteService, TopicViewStats, BookmarkedFilter e Directory perguntavam ao `information_schema` a cada processo PHP: até 18 consultas (~12–18 ms de banco) por página logada. Novo `src/Support/SchemaCache.php`: as colunas de cada tabela pedida ficam no cache do Flarum numa chave com o nº de linhas de `migrations` (o `migrate`/`migrate:reset` invalida sozinho; custa 1 `count` por processo).
- `RelatedController` (IA, tópicos relacionados): tags com eager loading em vez de uma consulta por tópico.
- Sem N+1 nos campos do tema na lista (`/api/discussions`): visualizações, participantes, Me too, links, marcadores e emblemas já vêm em buffer (1 consulta por campo por página).

Consultas por requisição (processo novo, usuário 1; antes = cache frio, depois = cache quente):

| Rota | Antes | Depois |
|---|---|---|
| `/d/7` | 118 (18 de esquema) | 100 |
| `/all` | 76 (18) | 58 |
| `/u/Ramon/summary` | 171 (16) | 155 |
| `/api/discussions` | 58 (4) | 54 |
| `/u/Ramon/summary` (visitante) | 133 (10) | 123 |

O resto das consultas é do core e de extensões de terceiros (p.ex. fof/polls faz um `exists` por post; fof/terms carrega as políticas por usuário).

### Pendências

- `canelaDialogCounts` e o `unreadDialogCount` do core são calculados uma vez por documento da API que inclui o ator (até 4 vezes no perfil): dá para guardar na memória da requisição, mas uma escrita no meio da requisição deixaria o valor velho. Ganho pequeno (~1 ms).
- Se uma tabela for apagada à mão (fora das migrations), rode `php flarum cache:clear`.

## Iteração 1 — frontend, build e CI

Medido em 2026-10-18 no fórum local (https://canela.test, PHP 8.5). Ferramentas no scratchpad da sessão: `perf.mjs` (Edge headless, visitante, cache desligado, mediana), `ttfb.sh` (curl, mediana de 5), `qcount.php`/`qcount.sh` (DB::listen numa requisição completa, processo novo; "logado" = usuário 1 com token numa transação desfeita), `lazycheck.mjs` (confere as telas que viraram chunk, logado ou visitante).

### Linha de base (antes)

| Arquivo | Bruto | gzip -9 |
|---|---:|---:|
| `js/dist/forum.js` (só o Canela) | 697.836 B | 190.743 B |
| `js/dist/admin.js` | 123.970 B | 38.371 B |
| `assets/forum-theme-ramon-canela.js` (core + extensões + Canela: o que o navegador baixa) | 1.753.982 B | 489.462 B |
| `assets/forum-theme-ramon-canela.css` (CSS compilado do fórum) | 786.156 B | 132.211 B |
| `assets/forum-pt-BR.js` | 211.860 B | 42.458 B |

Maior peso dentro do `forum.js` (fonte, antes de minificar): `features/` 746 KB (chat 207, messages 94, extras 82, composer 72, ai 68, community 49); ícones (`src/icons` + lucide) 125 KB já minificados; `gaps/` 100 KB; `topic/` 99 KB.

| Página (visitante) | TTFB HTML | Bytes |
|---|---:|---:|
| `/` | 420 ms | 89.358 |
| `/d/7` | 359 ms | 70.660 |
| `/u/marina.alves/summary` | 490 ms | 96.971 |
| `/t/ajuda` | 351 ms | 85.161 |
| `/api/discussions` | 262 ms | 54.417 |
| `/api/discussions/7` | 191 ms | 7.917 |

Consultas SQL por requisição (processo novo; medidas antes das mudanças de backend da seção acima):

| Rota | Visitante | Logado (usuário 1) |
|---|---:|---:|
| `/` | 37 (18 ms) | 80 (36 ms) |
| `/d/7` | 76 (36 ms) | 123 (42 ms) |
| `/u/marina.alves/summary` | 115 (54 ms) | 154 (59 ms) |
| `/t/ajuda` | 46 (18 ms) | 92 (38 ms) |
| `/api/discussions` | 30 (13 ms) | 50 (25 ms) |
| `/api/discussions/7` | 41 (13 ms) | 49 (12 ms) |

Navegador (visitante, cache desligado, mediana de 3): 15 requisições por página (1 documento, 1 CSS, 4 JS, 3 fontes, 5–7 imagens).

| Página | FCP | LCP | CLS | Transferido | Script |
|---|---:|---:|---:|---:|---:|
| `/` | 492 ms | 860 ms | 0 | 866 KB | 211 ms |
| `/d/7` | 596 ms | 1432 ms | 0,008 | 861 KB | 243 ms |
| `/u/marina.alves/summary` | 628 ms | 972 ms | 0 | 873 KB | 188 ms |
| `/t/ajuda` | 444 ms | 848 ms | 0 | 865 KB | 251 ms |

### O que mudou

**Chunks sob demanda** (`import()`, que o flarum-webpack-config nomeia e registra com `flarum.reg.addChunkModule`; o `extend.php` agora registra `->jsDirectory(js/dist/forum)` no tema base, para não depender do recurso `composer`):

- Páginas (rota com componente assíncrono, como o core faz com Configurações e Notificações): `/chat` (chunk `chatUi`: página + conteúdo da gaveta, canal, mensagens, editor, listas, informações do canal), `/ai/conversations`, `/badges`, `/badges/:id`, `/u/:u/badges`, `/u/:u/bookmarks`, `/u/:u/messages`, `/u/:u/notifications`, `/about`, `/guidelines`, `/faq`, `/u`, `/g`, `/g/:nome`, `/search`.
- A gaveta do chat desenha o conteúdo com `lazyComponent` (novo `js/src/forum/utils/lazy.tsx`): o `chatUi` só desce quando a gaveta abre. A fila de revisão (`/flags`) idem.
- Modais (`app.modal.show(() => import(...))`): atalhos de teclado, personalizar seção da barra, compartilhar, histórico de edições, marcador, nível de confiança, rascunho ao fechar, diff da IA, ir para o post, código/tabela em tela cheia.
- O que a página exportava e o resto do app usava foi para módulos pequenos: `features/ai/bot/routes.ts` (rotas, `askAi`, `isConversationsRoute`), `features/extras/search/route.ts` (`SEARCH_ROUTE`, `searchUrl`, `searchPageEnabled`), `gaps/topic/share.ts` (`openShare`).

**CI/CD e qualidade** (como no avocado-v2):

- `.github/workflows/ci.yml`: composer validate; matriz PHP 8.3/8.4/8.5 × core `^2.0.0`/`2.x-dev` com PHPUnit, `php -l`, `composer audit` e PHPStan; job JS com Prettier, `tsc`, ESLint, build e `npm audit`; paridade das traduções; dependency review.
- `.github/workflows/bundle-size.yml` + `.github/scripts/bundle-size.mjs`: tamanho bruto/gzip de todo `js/dist/**.js` (chunks inclusos), comentário na PR. `.github/dependabot.yml`.
- `phpstan.neon` (nível 5, `src`, `extend`, `extend.php`, `migrations`) + `phpstan-baseline.neon`; `phpunit.xml.dist`; `tests/Unit/LocaleParityTest.php` e `tests/Unit/FeatureLoaderTest.php` (todo nome em `extend/.enabled` tem arquivo, sem repetição, todo recurso devolve extenders); `composer.json` com `require-dev` e `scripts` (`composer test`, `composer analyse`).
- `js/eslint.config.mjs` + `js/eslint-local-rules/` (mithril-key e i18n; `react/jsx-key` desligada: no Mithril lista sem key é válida). `npm run build` roda o lint antes do webpack; `npm run check` = Prettier + tsc + lint. O `tsconfig.json` procura os typings em `../vendor` (CI) e `../../../vendor` (fórum local).

Rodando localmente: `tsc` 0 erros; Prettier reformatou 182 arquivos (só formatação: o `forum.js` saiu com o mesmo tamanho exato); ESLint 0 erros (3 textos fixos legítimos — "ms", "Slug", "Enter" — marcados com `eslint-disable-next-line` e o motivo); PHPUnit 6 testes OK; PHPStan nível 5 com 186 achados congelados no baseline (178 entradas). Localmente PHPStan/PHPUnit usam o autoload do fórum (o tema não tem `vendor` próprio): `scratchpad/qa/phpstan-local.neon` e `scratchpad/qa/bootstrap.php`.

### Depois

| Arquivo | Bruto | gzip -9 | Diferença |
|---|---:|---:|---|
| `js/dist/forum.js` | 571.763 B | 156.772 B | −126 KB (−18,1%); gzip −34 KB (−17,8%) |
| `assets/forum-theme-ramon-canela.js` | 1.627.909 B | 454.978 B | gzip −34,5 KB |
| 25 chunks novos (fora o `emoji-data`, que já existia) | 211 KB no total | — | `chatUi` 82 KB, `SearchPage` 19, `GroupPage` 15, `UsersPage` 10, `ReviewQueue` 10, os demais < 9 |

Navegador (visitante, cache desligado, mediana de 5): o transferido por página caiu ~33 KB (866 → 833 KB em `/`, 861 → 828 em `/d/7`, 873 → 840 no perfil, 865 → 832 em `/t/ajuda`). FCP, LCP e tempo de script ficaram dentro do ruído (±30–80 ms entre rodadas): no servidor local o FCP é dominado pelo TTFB do HTML (~400 ms), e o `forum-theme-ramon-canela.js` (core + ~20 extensões) ainda tem 1,6 MB. O HTML ganhou ~2 KB (o manifesto de revisões do core lista cada chunk, ~75 B cada).

Conferido com `lazycheck.mjs`: todas as páginas e modais acima abrem com o chunk certo e sem erro no console (logado e visitante; chat e IA ligados só dentro da transação desfeita do `sim-lazy.php`); `smoke ok` e `js ok` do build.

### PHPStan — achados congelados que merecem revisão

A maioria é magia do Eloquent/Laravel (`method.notFound` 48, `return.unusedType` 47, `argument.type` 45). Para olhar:

- `src/Links/LinkClicks.php:87,91` — `ENT_XML1 | ENT_HTML5` juntos em `html_entity_decode` (constantes exclusivas).
- `src/Ai/Llm/HttpTransport.php:45–54` — o PHPStan acha que `$status` nunca muda dentro da closure (é por referência: provável falso positivo).
- `src/Chat/ChatService.php:447,831`, `src/Chat/Console/PurgeChat.php:84,92`, `src/Links/LinkClicks.php:259` — `delete()`/`save()`/`getRawOriginal()` em `stdClass` (inferência do builder; conferir se a consulta é mesmo Eloquent).
- Tipos de retorno: `Chat/MessageQuery::fetch()`, `Gaps/Invites/InviteService::listFor()` (devolve `stdClass[]`, não `Invite[]`), `Badges/Search/UserBadgeSearcher::getQuery()`, `Community/Api/ShowAboutController::publicDiscussions()`/`publicPosts()`.
- `nullsafe.neverNull` (6) e `ShowGuidelinesController:58` (`method_exists` sempre verdadeiro): limpeza simples.

### Próximos alvos

1. **Ícones**: `src/forum/icons` + lucide = 125 KB do `forum.js`, o maior bloco. Gerar só os usados, ou mover os de telas raras para os chunks delas.
2. **`ChatStore`** (34 KB) e o resto do chat sempre presente entram mesmo com `canela.chat_enabled = 0`: carregar só quando `chatOn()`.
3. `lazyComponent` para: mensagens privadas (`features/messages`, 94 KB de fonte), busca do cabeçalho (`search/SearchMenu`, 22 KB), menu do usuário (`usermenu/panels` + `UserMenu`, 30 KB), `ProfileSettingsSection` (só em Configurações), `TopicViewsChart`, `EmojiPicker`, `HelperMenu` da IA.
4. **admin.js** (124 KB): cards dos recursos sob demanda por aba.
5. **CSS** (786 KB / 132 KB gzip): o LESS de recursos desligados (chat, IA) vai sempre.
6. TTFB do HTML (350–500 ms) é o maior custo da primeira pintura: perfilar o boot (extenders do tema, preload).
7. `extend/composer.php` ainda registra o mesmo `jsDirectory` (agora redundante; inofensivo, só compila duas vezes no `cache:clear`).

## Iteração 2 — backend

Ferramentas novas no scratchpad: `payload.php` (tamanho do `flarum-json-payload` por rota, visitante e usuário 1; `v` detalha), `payattr.php <rota>` (bytes por atributo/relacionamento no `apiDocument` e em cada `canelaPreload`). No Git Bash, rode com `MSYS_NO_PATHCONV=1` (senão `/` vira caminho do Windows e a rota dá 404).

### Payload do boot

Onde estão os bytes (usuário 1, antes): `/` 87 kB (fórum 12 kB, `apiDocument` 62 kB), `/d/7` 67 kB, `/u/marina.alves/summary` 102 kB (preload 74 kB, dos quais 64 kB são as 50 respostas com `include=discussion`). Quase tudo é do core e de terceiros (`avocado*`, fof); do tema:

- **Atributos do fórum só do admin** (`canelaAiDefaultPersonas`, `canelaAiSchemaReady`, `canelaBadgesCapabilities`, ~1,7 kB): já eram só para administradores, mas o documento do fórum é o mesmo `GET /api` nos dois frontends. `src/Preload/AdminOnlyForumAttributes.php` (conteúdo do frontend do fórum com prioridade 185, antes do `CorePayload`) os tira do HTML do fórum; o admin e o `GET /api` continuam recebendo tudo. Comparação feita: todo atributo `canela*` serializado × uso em `js/src/forum`/`common` (incluindo os nomes montados, `canelaComposer${…}` e `canelaProfile${…}`).
- **`canelaLocalDates`** saiu do `serializeToForum` (`extend/gaps.php`): as datas locais são do formatador (servidor), o JS do fórum não lê, e o admin lê `app.data.settings`.
- **`canelaBio` (texto cru)** só vai para a própria pessoa ou para quem pode editar o perfil (o JS só o usa nos formulários); quem vê recebe só o `canelaBioHtml`. Antes cada usuário de cada lista levava a bio duas vezes.

| Rota | Visitante antes → depois | Usuário 1 (admin) antes → depois |
|---|---|---|
| `/` | 71 408 → 70 657 | 87 078 → 85 390 |
| `/d/7` | 51 024 → 50 242 | 67 127 → 65 439 |
| `/u/marina.alves/summary` | 83 240 → 83 018 | 101 725 → 100 037 |

(bytes do JSON do payload; o admin edita todos os perfis, então para ele a bio crua continua.)

### Consultas

- `canelaDialogCounts`: guardado por 5 s no processo por usuário (`src/Messages/Api/UserFields.php`); o perfil próprio calculava 4 vezes (fórum, perfil, pré-carregados). O prazo curto limita o atraso num processo longo ou numa escrita no meio da requisição.
- `canelaMessageGroup` (toda página logada): o grupo da caixa da equipe e os membros saem de uma consulta só (`StaffGroups::members()`); o "contato" da equipe agora é o menor id (antes dependia da ordem do banco).
- "Novos"/"Não lidos" (`TopicCounter`): uma consulta (`UNION ALL` de duas buscas com `LIMIT` cada) e memo na instância, em vez de duas consultas com o escopo de visibilidade inteiro. Conferido igual ao cálculo antigo para os usuários 1, 2 e 3.
- Resumo do perfil (`ShowUserSummaryController`): as três listas de pessoas buscam os usuários numa consulta só (eram três).

| Rota (usuário 1, cache quente) | Antes | Depois |
|---|---|---|
| `/d/7` | 94 | 89 |
| `/all` | 51 | 46 |
| `/u/Ramon/summary` | 146 | 130 |
| `/u/marina.alves/summary` | 118 | 101 |
| `/api/canela-user-summary/1` | 14 (visitante 10) | 4 (visitante 1) |
| `/api/canela-counts` | 6 | 5 |

Tempo total das páginas sem mudança mensurável (variação de ±30 ms entre execuções); banco do resumo do perfil 55 → 35 ms.

### Cache

- **Resumo do perfil**: a resposta de `/api/canela-user-summary/{id}` fica 5 min em cache por (pessoa, quem pergunta) — o Discourse faz o mesmo com o `user_summary` (lá, 1 h). Quem pergunta entra na chave (visitantes compartilham a mesma, porque veem a mesma coisa), então ninguém recebe o que só outro veria; o nº de postagens e de tópicos da pessoa também entra, para uma postagem nova dela já aparecer. Curtidas e cliques novos aparecem em até 5 min.
- O **Sobre** já tinha 30 min de cache (só números públicos). **Diretório** e **emblemas** ficaram sem cache: dependem de quem pergunta (visibilidade, colunas, emblemas ganhos) e custam 3–7 consultas pequenas; um cache por ator não compensa aqui.
- Nada de `Cache-Control` público nas respostas da API: o core não faz, e a mesma URL serve visitante e logado (só o cookie muda).

### PHPStan (pedido do coordenador)

Os achados de `delete()`/`save()` em `stdClass` e de retorno `Query\Builder` (ChatService, PurgeChat, LinkClicks, InviteService::listFor, MessageQuery::fetch, UserBadgeSearcher::getQuery, ShowAboutController::publicDiscussions/publicPosts) **não eram bugs em execução**: sem o larastan, o PHPStan segue o `@mixin` do Eloquent e acha que `whereIn`/`limit`/`select` devolvem o query builder, quando em execução devolvem o próprio Builder do Eloquent. Corrigidos sem mudar o SQL: `whereKey`/`whereKeyNot` (métodos do Eloquent) no lugar de `whereIn('id')`, e os métodos repassados em instrução separada (a variável continua o Builder do Eloquent). `ENT_XML1 | ENT_HTML5` virou `ENT_HTML5` (o valor já era o mesmo, 48). Baseline regenerado: só saíram as 21 entradas resolvidas. `extend/composer.php` não registra mais o `jsDirectory` duplicado (fica o do `extend.php`).

### Pendências

- O maior pedaço do payload do tema é o pré-carregamento do Resumo: 50 respostas com `contentHtml`, `content` cru e todos os campos de terceiros (~64 kB). Cortar exige o JS pedir menos (p.ex. `fields[posts]=…` ou um limite menor); o preload tem de usar os mesmos parâmetros que o JS, senão a chave não bate. É do agente de JS.
- Os documentos pré-carregados repetem o mesmo usuário em `included` (p.ex. a pessoa do perfil em cada um): dedupe também depende do JS.
- `fof/polls` (um `exists` por post), `fof/terms` (políticas por documento) e `unreadDialogCount` do flarum/messages seguem repetindo consultas; são de terceiros.

## Iteração 2 — frontend (2026-10-18)

### Antes → depois

| Arquivo | Antes (bruto / gzip -9) | Depois (bruto / gzip -9) | Diferença |
|---|---:|---:|---|
| `js/dist/forum.js` | 571.763 / 156.772 | 472.108 / 129.222 | −99,7 KB (−17,4%); gzip −27,5 KB (−17,6%) |
| `js/dist/admin.js` | 123.970 / 38.371 | 10.995 / 3.521 | −91% (o painel virou o chunk `admin/panel`, 124 KB) |
| `assets/forum-theme-ramon-canela.js` | 1.627.909 / 454.978 | 1.528.254 / 427.580 | gzip −27,4 KB |
| `assets/forum-theme-ramon-canela.css` | 787.575 / 132.443 | 701.520 / 118.608 | −86 KB (−10,9%); gzip −13,8 KB (chat e IA desligados) |
| Payload do Resumo do perfil (`/u/marina.alves/summary`, logado) | HTML 99.541, preload 63.567 | HTML 59.537, preload 17.853 | −40 KB de HTML |

Navegador (visitante, cache desligado, mediana de 5): transferido 833 → ~793 KB em `/` e 828 → 788 em `/d/7` (−40 KB). FCP/LCP/script continuam dominados pelo TTFB e pelo ruído da máquina (o mesmo `/t/ajuda` deu script 147 e 253 ms em rodadas seguidas): sem conclusão de tempo além do ruído.

### O que mudou

- **Chat** (`features/chat`): o pacote principal só tem `flags.ts` (tradução, `caps`, `chatOn`), o tipo de notificação nas Configurações e o item do perfil. Store, gaveta, barra lateral, preferências e o atalho `-` moram no chunk `chat/runtime` (40 KB), pedido no `app.beforeMount` só quando `chatOn()`; o ícone do cabeçalho é um `lazyComponent` cujo provisório é o mesmo botão sem o indicador (largura igual). Com o chat desligado nada do chat desce. O `chatUi` passou a carregar a própria cópia do store (o `flarum-webpack-config` usa `maxAsyncRequests: 1`, sem chunk compartilhado); o webpack mantém uma instância só.
- **`utils/chunkGate.ts`** (`beforeChunk`, `once`): envolve `flarum.reg.loadChunk` para baixar um chunk do tema **antes** de um chunk de outro pacote. As extensões do tema por nome de módulo (`extend('ext:…')`) entram na fila do `onLoad` antes de o módulo chegar, e o componente já nasce estendido.
- **Mensagens** (`features/messages`): página, fluxo, mensagem, composer e reações do flarum/messages foram para o chunk `messages/ui` (31 KB), que desce antes de qualquer chunk do `flarum-messages`. No principal ficaram a aba do perfil, a barra lateral, o botão "Mensagem" e as ações do menu do composer (`composerActions.tsx`).
- **Menu do usuário**: o menu aberto e a lista de `/notifications` são o chunk `usermenu/menuChunk` (22 KB), pedido no `mouseenter`/`focus`/`touchstart` do avatar e antes do chunk `NotificationsPage` do core. Os textos que o principal usa estão em `usermenu/text.ts`. O índice não reexporta mais `UserMenu`/painéis (para estender: `ext:ramon/canela/forum/usermenu/UserMenu`).
- **Configurações do perfil** (`ProfileSettingsSection` + seletor de status, 13 KB): desce junto com o chunk `SettingsPage` do core.
- **Gráfico de visualizações** (`TopicViewsChart`): pedido junto com os números (o indicador de carregamento já existia); se o chunk falhar, os números sem gráfico.
- **Seletor de emoji** (`composer/emoji/pickerLazy.ts`): os botões do editor e do chat abrem pela versão sob demanda; `mouseenter`/`focus` no botão pré-carregam.
- **Ajudante de IA**: `HelperMenu` é um chunk pedido quando o editor aparece com a IA ligada; até chegar, o mesmo botão, e um clique nesse meio tempo abre o menu quando ele chega (`initiallyOpen`).
- **admin.js**: `admin/panel.tsx` (cards, ordem, `createPanel`) é um chunk pedido quando a página da extensão abre; a busca do painel continua nos mesmos cards. `extend.php` registra `->jsDirectory(js/dist/admin)`.
- **CSS**: `Chat.less` e `Ai.less` estão dentro de `& when (@config-canela-chat|ai = true)`; o `extend.php` registra `config-canela-chat`/`config-canela-ai` (`registerLessConfigVar` de `canela.chat_enabled`/`canela.ai_enabled`, sem valor = desligado). Salvar a opção no admin marca as folhas para recompilar (`ValidateCustomLess`). Duplicação: só ~5 KB de regras repetidas (keyframes e saídas de mixins) — não compensa mexer.
- **Resumo do perfil** (pedido do agente de backend): `UserSummaryPage` e `UserStats` pedem só os campos desenhados (JSON:API sparse fieldsets: `fields[posts]=number,createdAt,likesCount,discussion`, `fields[discussions]=title,slug[,commentCount,createdAt,firstPost]`, `fields[posts]=likesCount` no `firstPost`); `src/Preload/PreloadContent.php` espelha os mesmos `fields` (conferido: a página não faz nenhum pedido à API além de `/drafts`). Os limites (20 tópicos, 50 respostas) ficaram: a escolha das 6 mais curtidas depende da amostra.
- **Ícones**: medido de verdade, a camada de ícones é 54 KB do `forum.js` (desenhos do Lucide 38 KB em 233 ícones, `iconMap` 10 KB, `glyphs` 4 KB), não 125 KB (o número antigo era de fonte). O mapa não tem entradas mortas (todo alvo tem desenho; 2 apelidos sem efeito). Cruzando os ícones usados no core, nas 42 extensões instaladas, no tema e nas tags/grupos do banco, só 65 desenhos (~10 KB bruto, ~3,5 KB gzip) são raros. Num chunk, ou eles descem no boot mesmo (mesmos bytes) ou trocam do Font Awesome para o Lucide depois do primeiro desenho (e ficam no FA nos itens congelados pelo `SubtreeRetainer`). Ficaram no pacote principal, de propósito.
- **Ouvintes e redesenhos**: revisados `scroll`/`resize`/`keydown`/`setInterval`/observers. Os globais são instalados uma vez (lightbox, cartão de usuário, quem reagiu, menu do usuário, atalhos), os de componente saem no `onremove`, o cabeçalho usa `requestAnimationFrame`, os timers (rastreador de leitura, autosave dos rascunhos, chat) param. Nenhum `m.redraw()` em laço. Nada a corrigir.

Conferido com `lazycheck.mjs` (logado e visitante; chat, IA e visualizações ligados só na transação desfeita do `sim-lazy.php`): menu do usuário, `/notifications`, `/settings` (formulário do perfil), mapa do tópico, composer + emoji, ajudante de IA, `/messages/dialog/4` (página e post com as classes do tema), composer de mensagem, `/u/Ramon/messages`, chat (ícone, gaveta, `/chat`, preferências), admin (painel e busca). `npm run check` limpo; `smoke ok`/`js ok`.

### Pendências

- No Windows o manifesto de revisões do core grava as chaves dos chunks com `\` (`js\ramon-canela\forum\…`), então o chunk pode sair sem `?v=` e o navegador reaproveitar uma cópia velha (um perfil do Edge com o `UserMessagesPage` antigo deu `e[s] is not a function` até limpar o cache). É do core/ambiente; em produção Linux não acontece.
- Testar o chat/IA ligados de verdade no admin (a recompilação da folha) quando o usuário ligar um deles: no `sim-lazy.php` a opção muda só na transação, e a folha não é recompilada.
- `/badges` logado ainda pré-carrega 37 KB; o `forum.js` tem `search/` (18 KB) e `gaps/` (44 KB) como próximos blocos.
- O `forum-theme-ramon-canela.css` sai sem minificar (701 KB) e inclui o CSS inteiro do Font Awesome do core.

## Iteração 3 — lógica e testes (PHP)

Revisão de lógica de bookmarks, stats, badges, messages, community, gaps, metoo, links, usersummary, preload, profile e extras (o `src/Ai` ficou de fora). Ferramenta nova: `scratchpad/it3/counter.php` (TopicCounter numa tag oculta e extração de links, em transação desfeita).

### Bugs corrigidos

| Onde | O que estava errado | Correção |
|---|---|---|
| `Links/LinkClicks::extract` | O s9e grava os atributos em ordem alfabética: link com título (`[texto](url "título")`) vira `<URL title="…" url="…">`, e a expressão só aceitava `<URL url=`. Clique nesses links não era gravado (o endpoint confere se o endereço está na postagem) e eles não entravam nos links do tópico nem do perfil. | `<URL\b[^>]*?\surl="…"`; conferido com o formatador real. |
| `Stats/TopicCounter` | O corte das tags ocultas valia também na contagem de uma tag: a página de uma tag oculta mostrava sempre 0 em Novos/Não lidos, e um tópico de uma tag comum que também estivesse numa oculta sumia da contagem dela (a lista mostrava). | O corte só vale na contagem geral (como o core, que só esconde sem filtro). Conferido: tag oculta 0 → 1. |
| `Messages/Api/RecordDialogView` | A trava da visualização da mensagem não levava o dia (a do tópico leva, pela regra do Discourse): uma conversa aberta às 23h e às 7h contava uma vez só. | Usa `ViewRule::cacheKey()` (que existia para isso e não era usado). |
| `Messages/Api/DialogActions` (convite) | Dois convites iguais ao mesmo tempo (clique duplo, duas abas) batiam no índice único `(dialog_id, user_id)` e davam **500**. | `insertOrIgnore` por pessoa; o aviso "convidou fulano" só para quem entrou de fato. |
| `Badges/BadgeQueries` (dias seguidos) | A sequência usava `(int) diffInDays()` entre meias-noites: num fuso com horário de verão, dois dias seguidos distam 23 h e a conta dava 0 (sequência quebrada). | `streakCompletedOn()` compara as datas como texto (o dia seguinte de uma é a outra). |
| `Badges/TrustLevel/UserMetrics` | "Respostas a tópicos de outros" (nível 2) comparava `discussions.user_id != posts.user_id`; com o autor apagado (`NULL`) a comparação dá NULL e a resposta não contava. | `whereNull(...)->orWhereColumn(...)`. |
| `Community/Directory` | Curtidas recebidas contavam a curtida na própria postagem (`flarum-likes.like_own_post`); o resumo do perfil e os níveis de confiança já descontavam, então o diretório mostrava um número maior. | Mesmo filtro dos outros dois. |
| `Theme/Logo/SvgSanitizer` | CSS com escape (`\75 rl(`, `@\69mport`) passava pelas buscas de texto e o navegador o lia como `url(`/`@import` (busca externa a partir do logo). | CSS (no `<style>` ou no atributo `style`) com barra invertida não passa. |

Revisado sem achar erro: reserva da visualização de tópico (insert/UPDATE condicional, índices únicos por conta e por IP), robôs, tempo de leitura (relógio compartilhado entre abas, tetos por envio e por dia), Novos/Não lidos com "marcar tudo como lido", lembretes de marcador (`withoutOverlapping`, `chunkById` com a coluna filtrada), concessão de emblemas (dedupe por usuário/postagem, janela de notificação, backfill), promoção/rebaixamento de nível (confere com o `promotion.rb` do Discourse), convites do fórum (incremento condicional), "eu também" (transação, limite por hora), histórico de edições (autor/data de cada versão, conteúdo de postagem oculta), filtros da busca avançada, resumo do perfil (visibilidade das postagens em todas as listas, chave do cache por quem pergunta), validação do perfil (site, status com expiração, aniversário).

### Testes

`tests/Unit` passou de 2 para 15 arquivos (87 testes, 211 asserções). O avocado não usa `flarum/testing`; segui o mesmo caminho (unitários + SQLite em memória, sem boot do Flarum). Apoio em `tests/Support`: `ArraySettings` (configurações em memória) e `Sqlite` (conexão nova por teste).

- Regras puras: `LinkClicksExtractTest` (inclui o link com título), `ViewRuleTest`, `BadgeStreakTest` (inclui o horário de verão), `PreloadKeyTest` (paridade com o `preloadKey()` do JS), `SvgSanitizerTest`, `BioRendererTest`, `VisitorTest` (robôs, celular, hash do IP), `ProfileValidationTest` (emoji do status, campos de uma linha, teto da bio, campos desligados).
- Com SQLite: `TopicViewClaimTest` (uma por janela, dia novo, visitante × membro, aba atrasada não conta em dobro), `ReadingTimeTest` (relógio real, duas abas, valor negativo, teto do dia, uma linha por dia), `MeTooTest` (alternar, contagem, quem não pode), `BookmarkModelTest` (lembrete em UTC, mesma hora não rearma, nome).

Os testes de `LinkClicksExtractTest::test_link_com_titulo` e `BadgeStreakTest::test_horario_de_verao_nao_quebra_a_sequencia` falhavam com o código antigo.

Local: `php qa/vendor/bin/phpunit --bootstrap qa/bootstrap.php` (OK, 87) e `phpstan analyse -c qa/phpstan-local.neon` (sem erros, baseline intacto); `build.sh css`: `smoke ok`, `js ok`; `msgtest.php` (mensagens, convite, visualização) sem 5xx.

### Pendências

- Concessão automática de emblema de concessão única em duas requisições simultâneas (duas curtidas ao mesmo tempo na mesma pessoa) pode duplicar: o índice único `(badge_id, user_id, post_id)` não segura quando o `post_id` varia ou é NULL. Precisa de trava (cache lock por emblema/pessoa) ou coluna gerada; raro e inofensivo, não mexi.
- `nice_post`/`good_post`… e `appreciated`/`respected`… contam a curtida na própria postagem quando `like_own_post` está ligado (o Discourse nem permite). Uma linha em `likeCounts()` resolveria, mas muda quem já ganhou; decidir junto com o usuário.
- `RecordRevision` (histórico de edições) e `MessageReactions::react` (`updateOrInsert`) podem dar erro de índice único em duas escritas simultâneas na mesma postagem/mensagem; raríssimo.
- `InvitesController` tem a mensagem de "convites demais" em pt-BR fixo no código (deveria vir de `locale/`).
- Estatísticas do **Sobre** contam tópicos de tags restritas (só número, sem conteúdo); o Discourse conta só o que é público.

## Iteração 4 — backend

### Como foi medido

`scratchpad/it4/prof.php`: uma requisição HTML completa por processo (CLI com o mesmo OPcache em arquivo do Apache), visitante ou usuário 1 (token numa transação desfeita), carregando cópias instrumentadas de `Extension`, `Application`, `ConsoleServiceProvider`, `Frontend` e `PreloadContent` antes do autoloader — nada de instrumentação no código do site. `run.php` tira a mediana de 7 execuções; `X-Canela-Probe: none` desliga os recursos (fica só o tema base) e serve de comparação. Para achar o custo dentro das fases, o Xdebug 3.5 (DLL só no scratchpad, carregada com `-d zend_extension` no CLI) com `cg.py`/`callers.py`. No Git Bash, os scripts precisam de `MSYS_NO_PATHCONV=1` (senão `/d/7` vira `C:/Program Files/Git/d/7` e tudo dá 404).

### Onde vai o tempo (antes, ms, mediana CLI)

| Fase | `/` vis. / logado | `/d/7` vis. / logado | `/u/Ramon/summary` vis. / logado |
|---|---|---|---|
| Boot (core + 42 extensões) | 94 / 96 | 94 / 95 | 97 / 93 |
| └ do tema: `extend*.php` + extenders + comandos agendados | 4 + 1 + 2 | 4 + 1 + 2 | 4 + 1 + 2 |
| Documento do fórum (`/api` interno) | 36 / 49 | 36 / 53 | 34 / 51 |
| Conteúdo da rota (core) | 79 / 81 | 129 / 108 | 8 / 8 |
| Pré-carregamento do tema (`PreloadContent`) | — | — | **127 / 96** |
| Assets (core + wardrobe) | 24 | 25 | 24 |
| Requisição inteira (sem o boot) | 150 / 176 | 201 / 205 | 211 / 197 |
| O mesmo com `probe: none` | 141 / 173 | 195 / 179 | 72 / 89 |

O tema custa ~7 ms no boot e 5–25 ms por página (campos dos recursos: Novos/Não lidos, marcadores, perfil, tags não lidas, tradução — nenhum acima de ~1 ms; o perfil do Xdebug não mostra nada dominante). O que pesa é o **pré-carregamento do Resumo do perfil**: 6 pedidos à API interna, ~100–125 ms. Dentro dele o tempo não é SQL (26 ms em ~85 consultas), é montar as consultas de visibilidade do core/tags (`Discussion::whereVisibleTo` ~80 vezes por pedido, nas inclusões padrão) e serializar.

- `posts?filter[likedBy]=…&page[limit]=1` (só para o total de curtidas dadas) custava 40–50 ms: trazia uma postagem inteira com as inclusões padrão e o HTML do conteúdo.
- O agendador do Flarum (`ConsoleServiceProvider::boot`) **instancia todo comando agendado em toda requisição**, HTML ou API. O `canela:badges` montava o `BadgeGranter` e as dependências (~2 ms). (O `drafts:publish` do fof/drafts custa ~50 ms no primeiro uso, mas é só a primeira resolução do tradutor/JsonApi, que a página resolveria de qualquer jeito.)
- `SchemaCache` funcionando: depois de um `cache:clear` a primeira requisição faz 4 conferências de esquema (~6 ms), as seguintes nenhuma.
- Revisado sem achado: os `extend/*.php` não fazem trabalho no carregamento (nenhum arquivo lido, nada resolvido); configurações são lidas do repositório em memória; as variáveis de LESS só são avaliadas na compilação.

### O que mudou

- **`PreloadContent`**: o terceiro item do plano recebe também um `fetch`, para montar a resposta com um pedido mais barato sob a mesma chave do JS. Curtidas dadas: o mesmo filtro com `fields[posts]=number&include=` e a resposta vira `{data: [], meta}` — o `UserSummaryPage` só lê `meta.page.total` (conferido no navegador: "11 dados", igual). 40–50 → 19 ms.
- **`BadgesCommand`** recebe só o contêiner e resolve as peças no `fire()`: comandos agendados do tema 1,9 → 0,7 ms em toda requisição.

### Depois (ms, mediana CLI de 7)

| Rota | Requisição antes → depois | Pré-carregamento antes → depois | `probe: none` |
|---|---|---|---|
| `/` visitante / logado | 150 → 145 / 176 → 170 | — | 134 / 153 |
| `/d/7` visitante / logado | 201 → 194 / 205 → 197 | — | 188 / 188 |
| `/u/Ramon/summary` visitante | 211 → **169** | 127 → **94** | 72 |
| `/u/Ramon/summary` logado | 197 → **170** | 96 → **73** | 86 |

No Apache (TTFB, mediana de 12, alternando com `probe: none`): `/u/Ramon/summary` 307 → 297 ms (none: 161), `/` 249–255 (none: 214–229), `/d/7` 320 (none: 264). O ruído da máquina é de ±20–30 ms entre rodadas; as medidas de CLI são as confiáveis.

### Pendências da iteração 3 resolvidas

| Onde | O que estava errado | Correção |
|---|---|---|
| `Badges/BadgeGranter` (concessão única) | Duas requisições ao mesmo tempo (duas curtidas na mesma pessoa) davam o emblema duas vezes: o índice único `(badge_id, user_id, post_id)` não segura com `post_id` diferente ou NULL. | `Badges/SingleGrantLock`: trava do cache por (emblema, pessoa) + conferência com `sharedLock()` (lê o último dado gravado mesmo numa transação aberta) + gravação. Dentro de uma transação a trava só sai no `afterCommit`/`afterRollBack` (antes disso o outro processo não veria a linha). Trava de outro processo por mais de 3 s: este desiste (a carga diária completa). Conferido com o banco e o cache de arquivo reais numa transação desfeita. |
| `Extras/History/RecordRevision` | Duas edições simultâneas da mesma postagem liam o mesmo último número e a segunda dava **500** no índice `(post_id, revision)`, com a postagem já salva. | Captura só `UniqueConstraintViolationException` e grava no número seguinte (até 3 tentativas; depois, aviso no log). As duas versões ficam no histórico. |
| `Messages/Reactions/MessageReactions::react` | `updateOrInsert` confere e depois insere: dois cliques ao mesmo tempo davam **500** no índice `(message_id, user_id)`. | `upsert` (uma instrução, `INSERT … ON DUPLICATE KEY UPDATE`): vale a última reação. |
| `Gaps/Invites/Http/InvitesController` | "Convites ativos demais" em pt-BR fixo no código. | Chave `ramon-canela.api.invites.too_many` em pt-BR, en e ja (`InvitesController::TOO_MANY_KEY`). |
| `Community/Api/ShowAboutController` | As estatísticas do Sobre contavam tópicos (e postagens e curtidas deles) de tags restritas. | Tópicos com `Discussion::whereVisibleTo(new Guest)` — as regras de visibilidade do core e das extensões para o visitante, como o Discourse; postagens e curtidas só desses tópicos. Fórum fechado a visitantes (tudo daria zero): fora os tópicos de tags com permissões próprias. Chave do cache `canela.about.overview.v2` (sem servir os números antigos por 30 min). Aqui: tópicos 24 → 23, curtidas 16 → 15. |

### Testes

`tests/Unit/ConcurrentWritesTest.php` (6): emblema único não duplica com post diferente ou NULL; trava de outro processo → desiste; a trava só sai depois do commit; duas edições ao mesmo tempo guardam as duas versões; reação concorrente nas duas janelas (depois da leitura e entre o "existe?" e o INSERT). A "outra requisição" é um ouvinte de consulta que grava a linha concorrente logo depois do SELECT. O código antigo, na mesma corrida, lança `UniqueConstraintViolationException` (conferido em `it4/oldrace.php`). `tests/Unit/InvitesMessageTest.php` (4): a chave nos três idiomas e nenhum texto fixo no controlador. `tests/Support/Sqlite` dá nome à conexão (o gerenciador de transações usa o nome como chave).

PHPUnit: OK (97 testes, 263 asserções, sem avisos). PHPStan com o baseline: sem erros, baseline intacto. `build.sh css`: `smoke ok`, `js ok`.

### Pendências

- O Resumo do perfil ainda pré-carrega ~75–95 ms (o `/discussions` do "Tópicos principais" é o maior: ~40 ms na primeira chamada do processo, ~24 ms nas seguintes, quase tudo visibilidade do core/tags). Cortar mais exigiria cache do pré-carregamento (muda a atualização: um tópico ocultado continuaria na lista do visitante até o prazo) ou o JS pedir menos; não mexi.
- `grantManually` (emblema dado pela administração) não passa pela trava: um clique duplo no "Conceder" ainda pode duplicar um emblema de concessão única.
- O boot do core + 42 extensões é ~85–95 ms por requisição (o OPcache está em `file_cache_only`, sem memória compartilhada); é do ambiente, não do tema.

## Iteração 3 — frontend

### Antes → depois

| Medida | Antes | Depois |
|---|---:|---:|
| `js/dist/forum.js` (bruto / gzip -9) | 478.388 / 131.188 | 470.042 / 128.351 (−16 KB meus; outro agente somou ~8 KB em `user/activity` no mesmo período) |
| └ `search/` no pacote principal | 17.757 | 7.078 |
| └ `gaps/cooked/lightbox` + `gaps/backend/invites` | 8.867 | 3.526 |
| Chunks novos | — | `search/SearchPanel` 13,7 KB, `gaps/cooked/LightboxView` 3,9 KB, `gaps/backend/InviteModal` 3,6 KB |
| `forum-theme-ramon-canela.css` (bruto / gzip) | 714.689 / 120.342 | 713.423 / 120.119 |
| `/badges` logado: pré-carregamento / HTML | 36.981 / 77.028 B | 11.844 / 51.065 B (consultas 41 → 33) |
| `/badges` visitante: pré-carregamento / HTML | 14.547 / 47.511 B | 9.200 / 42.546 B |
| Fontes pré-carregadas por página | fa-solid + fa-regular + Inter | fa-solid + Inter (−19,5 KB na primeira visita) |

Navegador (visitante, cache desligado, mediana de 5): 3 → 2 fontes por página; transferido `/` 793 → 788 KB, `/d/7` 788 → 775, perfil 797 → 784, `/t/ajuda` 795 → 779 (o `SearchPanel` desce no ocioso e entra na conta). Tempos dentro do ruído (outros agentes compilando ao mesmo tempo).

### CSS

- **Minificação**: o Flarum 2 já compila o LESS com `compress: true` (`LessCompiler::compile`); o CSS do tema sai minificado. Só os `@import (inline)` do `Iconography.less` do core (`fontawesome.css`, `brands.css`, faces `regular`/`solid`) entram crus: 129 KB / 23,7 KB gzip no topo da folha. O `flarum/font-awesome` traz as versões `.min.css` (89,5 KB / 21,8 KB gzip): −39 KB bruto, **−1,8 KB gzip**. Não dá pelo LESS do tema (o `overrideLessImport` do core não casa com `(inline)` e só vale no arquivo de topo); daria com uma subclasse do `LessCompiler` ligada no contêiner (`resolve(LessCompiler::class, …)` em `Assets::makeLessCompiler`) que troque `X.css` por `X.min.css` no `containImports()`. É backend e o ganho é pequeno: ficou como pendência.
- **Font Awesome**: medido no navegador (logado e visitante, 21 rotas, `getComputedStyle(el, '::before')`) quem ainda desenha com a fonte do FA: ícones de tag (`tagIcon` do flarum/tags, fora do componente `Icon`), o botão de modo de cor do wardrobe (`fa-solid fa-circle-half-stroke`), emblemas de grupo (`fa-bolt`), os botões dos blocos de código (`decorate.ts`, HTML em texto: `far fa-copy`, tela cheia), anexar/câmera do editor, `fab fa-markdown`, marcas na janela de compartilhar. As regras e o fa-solid ficam (toda página usa). Só o preload do **fa-regular** saiu (`extend.php`, conteúdo depois do core, só com `canela.lucide_icons` ligado): ele só desenha o "copiar" dos blocos de código, que no computador aparece só no hover; a fonte desce sob demanda quando o ícone existe.
- **Regras mortas** (`scratchpad/it3fe/deadcss.py`: classes dos seletores do `less/` cruzadas com todo JS/PHP/blade/JSON do tema, do core, das extensões e dos assets compilados, aceitando prefixo montado no código): 22 classes removidas — `CanelaBadgeShow-header`, `CanelaCommunity-title`/`-sectionTitle`, `CanelaComposerRich`, `CanelaFadeIn`, `CanelaHeader-advanced`, `CanelaLikers(-more)`, `CanelaMessagesCount`, `CanelaPostAction--control`/`--text`, `CanelaPostNames-group`, `CanelaSearchMenu-input`, `NotificationsDropdown-unread`, `PostMeta-link`, `Search-input-icon`, `SubscriptionOptionsList`, `UserDirectoryList-loadMore`, três `*unread-indicator__number` do chat, `.dropup` — e os `@keyframes` que ficaram sem uso (`cn-fadein`, `cn-dissolve-down`). Ficaram `itemCount1` (o core monta `itemCount` + n) e `onebox` (vem do conteúdo).

### JS

- **Menu de busca**: o campo (`SearchMenu`, `state.ts` com termo/carregando, `query.ts` com a URL da busca cheia) segue no pacote principal e desenha igual na primeira pintura. O painel (`SearchPanel.tsx`: resultados, assistente, dicas, recentes), o motor da busca (`engine.ts`: espera, sugestões, pedidos) e `assist.ts` (recentes, dicas, atalhos) são o chunk `search/SearchPanel`, pedido no ocioso do boot (`requestIdleCallback`, 4 s no máximo), no `mouseenter`/`touchstart`/`focusin` do campo, ou quando o painel abre. Com o chunk presente, `withSearchPanel` roda síncrono (o redesenho do evento de digitar já vê o carregando); sem ele, roda na chegada e redesenha. O painel nasce a cada abertura (a dica aleatória muda, como antes).
- **Lightbox**: o ouvinte de clique e a escolha das imagens ficam; a camada (`LightboxView.tsx`) desce no primeiro `mouseover`/`touchstart` numa imagem de post (ou no clique).
- **Convites**: `InviteModal.tsx` virou chunk (`openInviteModal()`), aberto pela barra lateral e pela janela de compartilhar.
- Fora, de propósito: `gaps/shortcuts.ts` (8,9 KB) — vários atalhos precisam do `preventDefault` síncrono (Ctrl+P imprimir, `/`, `#`, Home/End); `decorate.ts` (blocos de código, já na primeira pintura do tópico); o resto de `gaps/` é da primeira pintura (barra lateral, lista, tópico) ou registro de notificações.

### `/badges`

A grade pede `fields[badges]=slug,name,description,icon,imageUrl,type,grouping,grantCount` (`LIST_FIELDS`; sem a descrição longa e as colunas do admin, que a página do emblema pede no Show) e a marca de conquistado usa `loadOwnedBadgeIds()`: `user-badges` com `include=badge`, `fields[user-badges]=badge`, `fields[badges]=slug` (fora do cache de `loadUserBadges`, que o cartão e o resumo usam com concessões completas). `PreloadContent` espelha os dois pedidos (`BADGE_LIST_FIELDS`, `ownedBadges()`).

### Conferido

`lazycheck.mjs` (agora com `report` e as fontes `fa-*` pedidas, cache desligado): busca (foco abre o painel com a dica, digitar mostra "em todos os tópicos", Enter traz os tópicos, `#` abre o assistente com 8 itens, seta para baixo foca o primeiro link, Esc fecha), celular (lupa abre o campo focado com o painel), lightbox (`/d/23`, "1 de 2"), convite pela barra e pela janela de compartilhar, `/badges` (34 cartões; logado 11 conquistados, igual às 11 concessões distintas do usuário 1) e a página do emblema com a descrição longa, resumo do perfil com os emblemas, `lazy-final.json` (o `/chat` falha porque o chat está desligado no banco e o `sim-lazy.php` não o liga mais). Prints em `scratchpad/shots/it3-*.png`. `npm run check`: tsc e ESLint limpos (Prettier acusa 4 arquivos que outros agentes estão editando: `DraftsMenu`, `reactions`, `index.ts`, `UserMenu`); PHPUnit OK (97); `smoke ok`/`js ok`.

### Pendências

- Minificar o FA inline (−1,8 KB gzip) com a subclasse do `LessCompiler` descrita acima (backend).
- Os botões dos blocos de código (`decorate.ts`) montam `<i class="far fa-copy">` em texto e não passam pelo Lucide; trocar por SVG muda o desenho (decidir com o usuário). Idem os ícones de tag/grupo do flarum/tags e do wardrobe.
- `gaps/shortcuts.ts` só sai do pacote com uma tabela síncrona das teclas que precisam de `preventDefault`.
