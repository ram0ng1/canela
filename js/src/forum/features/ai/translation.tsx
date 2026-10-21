/*
 * Tradução automática do conteúdo (o `ai_translation` do Discourse AI).
 *
 * O servidor manda, junto com cada postagem e tópico, a tradução para o idioma
 * de quem lê (quando já existe) ou a marca `canelaTranslatable` (falta
 * traduzir). A página desenha o original na hora e, logo depois, pede as que
 * faltam em lote (POST /canela/ai/translate) — a leitura nunca espera o modelo.
 *
 * A tradução entra pelo próprio modelo (`contentHtml()` e `title()`), então
 * aparece em todo lugar que mostra o post ou o título; o 文A à esquerda da
 * data alterna aquela postagem (na primeira, também o título do tópico), e o
 * 文A do topo da linha do tempo abre as "Preferências de idioma do conteúdo"
 * do Discourse: os idiomas que a pessoa lê no original e a tradução
 * automática (na conta, ou neste navegador para visitantes). Enquanto uma postagem
 * está sendo traduzida, um ícone girando fica no lugar do 文A. Editar o
 * título sempre parte do título original.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Post from 'flarum/common/models/Post';
import Discussion from 'flarum/common/models/Discussion';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionHero from 'flarum/forum/components/DiscussionHero';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import Icon from 'flarum/common/components/Icon';
import Button from 'flarum/common/components/Button';
import Tooltip from 'flarum/common/components/Tooltip';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { aiApiUrl } from './state';
import { displayNames } from '../../utils/intl';

interface TranslationInfo {
  locale: string | null;
  titles: boolean;
}

type Kind = 'p' | 'd';

const STORAGE_KEY = 'canela.translation.showOriginal';
/** Quantas rodadas seguidas o fórum pede o que voltou "pendente". */
const MAX_ROUNDS = 6;
const BATCH = 20;

function info(): TranslationInfo | null {
  const value = app.forum?.attribute<TranslationInfo | null>('canelaAiTranslation');

  return value && value.locale ? value : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Original ou tradução
// ─────────────────────────────────────────────────────────────────────────────

/** Os itens que a pessoa virou um a um, ao contrário do modo do tópico. */
const flipped = new Set<string>();
/** Ligado enquanto o título original precisa sair do modelo (renomear). */
let bypass = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Preferências de idioma do conteúdo (o modal do 文A da linha do tempo)
// ─────────────────────────────────────────────────────────────────────────────

const UNDERSTOOD_KEY = 'canela.translation.understood';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Navegação privada: vale só nesta página.
  }
}

/** Os idiomas que a pessoa lê sem tradução (na conta; no navegador, para visitantes). */
export function understoodLocales(): string[] {
  const user = app.session.user;

  if (user) {
    const value = (user.preferences() as Record<string, unknown> | undefined)?.canelaUnderstoodLocales;

    return Array.isArray(value) ? value.filter((code): code is string => typeof code === 'string') : [];
  }

  try {
    const value = JSON.parse(readStorage(UNDERSTOOD_KEY) || '[]');

    return Array.isArray(value) ? value.filter((code): code is string => typeof code === 'string') : [];
  } catch {
    return [];
  }
}

/** "Traduzir automaticamente": desligado, o tópico abre no original. */
export function autoTranslate(): boolean {
  const user = app.session.user;

  if (user) return (user.preferences() as Record<string, unknown> | undefined)?.canelaAutoTranslate !== false;

  // O "mostrar original" que este navegador já guardava vale como desligado.
  return readStorage(STORAGE_KEY) !== '1';
}

export function saveContentLanguagePreferences(understood: string[], auto: boolean): Promise<unknown> {
  const user = app.session.user;

  flipped.clear();

  if (user) return user.savePreferences({ canelaUnderstoodLocales: understood, canelaAutoTranslate: auto }).then(() => m.redraw());

  writeStorage(UNDERSTOOD_KEY, JSON.stringify(understood));
  writeStorage(STORAGE_KEY, auto ? '0' : '1');
  m.redraw();

  return Promise.resolve();
}

/** "pt-BR" e "pt" contam como o mesmo idioma: quem entende português lê os dois. */
function baseLanguage(code: string): string {
  return code.split(/[-_]/)[0].toLowerCase();
}

function understood(locale: string | null | undefined): boolean {
  if (!locale) return false;

  const base = baseLanguage(locale);

  return understoodLocales().some((code) => baseLanguage(code) === base);
}

function itemLocale(kind: Kind, id: string): string | null {
  if (kind === 'p') return app.store.getById<Post>('posts', id)?.attribute<string | null>('canelaLocale') ?? null;

  return app.store.getById<Discussion>('discussions', id)?.attribute<string | null>('canelaTitleLocale') ?? null;
}

/** Sem virar nada à mão, o item sai no original? */
function originalByDefault(kind: Kind, id: string): boolean {
  return !autoTranslate() || understood(itemLocale(kind, id));
}

function showing(kind: Kind, id: string | undefined): boolean {
  if (bypass > 0 || !id) return false;

  return originalByDefault(kind, id) ? flipped.has(`${kind}${id}`) : !flipped.has(`${kind}${id}`);
}

/** Vira juntos (o 文A da primeira postagem vira também o título). */
function flip(keys: string[]): void {
  keys.forEach((key) => {
    if (flipped.has(key)) flipped.delete(key);
    else flipped.add(key);
  });

  m.redraw();
}

/** O valor original do modelo, sem a tradução (para editar e comparar). */
export function withOriginal<T>(callback: () => T): T {
  bypass++;

  try {
    return callback();
  } finally {
    bypass--;
  }
}

function postTranslation(post: Post): string | null {
  return (post.attribute<string | null>('canelaTranslation') as string | null) || null;
}

function titleTranslation(discussion: Discussion): string | null {
  return (discussion.attribute<string | null>('canelaTitleTranslation') as string | null) || null;
}

/** "inglês" → "Inglês", no idioma da interface. */
function languageName(code: string | null | undefined): string {
  if (!code) return '';

  try {
    const name = displayNames([app.translator.getLocale() || 'en'], { type: 'language' }).of(code) || code;

    return name.charAt(0).toLocaleUpperCase() + name.slice(1);
  } catch {
    return code;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pedidos (em lote, depois de desenhar)
// ─────────────────────────────────────────────────────────────────────────────

const queue = { posts: new Map<string, Post>(), discussions: new Map<string, Discussion>() };
/** Já pedidos nesta página, pela versão do conteúdo: não pede duas vezes o mesmo. */
const asked = new Set<string>();
/** Postagens na fila ou no modelo agora: mostram o "traduzindo…". */
const working = new Set<string>();
let timer = 0;
let rounds = 0;

function versionKey(kind: Kind, model: Post | Discussion): string {
  const version = kind === 'p' ? String((model as Post).editedAt()?.getTime() || '') : String((model as Discussion).attribute('title') || '');

  return `${kind}${model.id()}:${version}`;
}

function enqueue(kind: Kind, model: Post | Discussion | undefined | null): void {
  if (!model || !info()) return;

  const flag = kind === 'p' ? 'canelaTranslatable' : 'canelaTitleTranslatable';

  if (!model.attribute(flag)) return;

  // Nada de gastar o modelo com o que a pessoa vai ler no original: tradução
  // automática desligada, ou um idioma que ela entende.
  if (!autoTranslate() || understood(model.attribute<string | null>(kind === 'p' ? 'canelaLocale' : 'canelaTitleLocale'))) return;

  const key = versionKey(kind, model);

  if (asked.has(key)) return;

  asked.add(key);
  // Um lote novo começa a contagem de novo: sem isso, depois que um tópico
  // desistia, todos os seguintes na mesma visita ganhavam uma rodada só.
  rounds = 0;

  if (kind === 'p') {
    queue.posts.set(model.id()!, model as Post);
    working.add(model.id()!);
  } else {
    queue.discussions.set(model.id()!, model as Discussion);
  }

  schedule(250);
}

function schedule(delay: number): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(flushWhenVisible, delay);
}

/** Com a aba escondida, espera ela voltar: ninguém está lendo a tradução. */
function flushWhenVisible(): void {
  if (!document.hidden) {
    flush();
    return;
  }

  const resume = () => {
    if (document.hidden) return;

    document.removeEventListener('visibilitychange', resume);
    flush();
  };

  document.addEventListener('visibilitychange', resume);
}

/** Espera crescente enquanto o servidor responde "pendente": 1,5 s, 3 s, 6 s, 12 s… */
function pendingDelay(): number {
  return Math.min(12000, 1500 * 2 ** Math.max(0, rounds - 1));
}

async function flush(): Promise<void> {
  const posts = Array.from(queue.posts.values()).slice(0, BATCH);
  const discussions = Array.from(queue.discussions.values()).slice(0, BATCH);

  posts.forEach((post) => queue.posts.delete(post.id()!));
  discussions.forEach((discussion) => queue.discussions.delete(discussion.id()!));

  if (!posts.length && !discussions.length) return;

  let response: any;

  try {
    response = await app.request<any>({
      method: 'POST',
      url: aiApiUrl('translate'),
      body: { posts: posts.map((post) => post.id()), discussions: discussions.map((discussion) => discussion.id()) },
      // Falhou, fica o original: não é um erro que a pessoa precise ver.
      errorHandler: () => {},
    });
  } catch {
    posts.forEach((post) => working.delete(post.id()!));
    m.redraw();

    return;
  }

  let pending = false;
  /** O servidor traduziu mais uma parte de alguma postagem longa. */
  let advanced = false;

  posts.forEach((post) => {
    const result = response?.posts?.[post.id()!];

    if (result?.html) {
      working.delete(post.id()!);
      post.pushAttributes({ canelaTranslation: result.html, canelaLocale: result.locale, canelaTranslatable: false });
    } else if (result?.pending) {
      pending = true;
      advanced = advanced || !!result.partial;
      queue.posts.set(post.id()!, post);
    } else {
      working.delete(post.id()!);
    }
  });

  discussions.forEach((discussion) => {
    const result = response?.discussions?.[discussion.id()!];

    if (result?.title) {
      discussion.pushAttributes({ canelaTitleTranslation: result.title, canelaTitleLocale: result.locale, canelaTitleTranslatable: false });
    } else if (result?.pending) {
      pending = true;
      queue.discussions.set(discussion.id()!, discussion);
    }
  });

  m.redraw();

  // O que sobrou deste lote (ou ficou pendente) vai na próxima rodada; o
  // limite de rodadas segura um servidor que só responde "pendente". Uma
  // postagem longa que avançou uma parte não gasta rodada: segue logo.
  const more = queue.posts.size > 0 || queue.discussions.size > 0;

  if (!more) return;

  if (!pending || advanced || ++rounds <= MAX_ROUNDS) {
    if (advanced) rounds = 0;
    schedule(response?.retryAfter ? response.retryAfter * 1000 : advanced ? 200 : pending ? pendingDelay() : 50);
  } else {
    // Desistiu por agora: some o "traduzindo…"; o próximo carregamento tenta de novo.
    queue.posts.forEach((_post, id) => working.delete(id));
    queue.posts.clear();
    queue.discussions.clear();
    m.redraw();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * O 文A: tooltip com o idioma original e o aviso; clicar alterna. `keys` são
 * os itens que viram juntos (a postagem e, na primeira, o título).
 */
function indicator(kind: Kind, id: string, locale: string | null | undefined, keys: string[] = [`${kind}${id}`]): Mithril.Children {
  const translated = showing(kind, id);
  const language = languageName(locale);
  const what = app.translator.trans(`ramon-canela.forum.ai.translation.${kind === 'p' ? 'original_language' : 'title_original_language'}`, {
    language,
  });
  const action = app.translator.trans(`ramon-canela.forum.ai.translation.${translated ? 'click_to_show_original' : 'click_to_show_translation'}`);

  return (
    <span className={classList('CanelaTranslated', { 'is-original': !translated })}>
      <button
        type="button"
        className="CanelaTranslated-button"
        aria-pressed={translated ? 'true' : 'false'}
        aria-label={`${what} ${action}`}
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          flip(keys);
        }}
      >
        <Icon name="fas fa-language" />
      </button>
      <span className="CanelaTranslated-tip" role="tooltip">
        <span className="CanelaTranslated-tipText">
          {what} {action}
        </span>
        <span className="CanelaTranslated-disclaimer">{app.translator.trans('ramon-canela.forum.ai.translation.disclaimer')}</span>
      </span>
    </span>
  );
}

/** O "traduzindo…": a postagem está na fila ou no modelo. */
function translating(): Mithril.Children {
  const label = app.translator.trans('ramon-canela.forum.ai.translation.translating') as string;

  return (
    <span className="CanelaTranslated is-working" role="status" aria-label={label} title={label}>
      <span className="CanelaTranslated-button">
        <Icon name="fas fa-spinner fa-spin" />
      </span>
    </span>
  );
}

export default function installTranslation(): void {
  // A tradução pelo próprio modelo: aparece no post, nas citações e na prévia.
  override(Post.prototype as any, 'contentHtml', function (this: Post, original: () => string | null | undefined) {
    const html = postTranslation(this);

    return html && showing('p', this.id()) ? html : original();
  });

  override(Discussion.prototype, 'title', function (this: Discussion, original: () => string) {
    const title = titleTranslation(this);

    return title && showing('d', this.id()) ? title : original();
  });

  // Renomear parte do título original, nunca da tradução.
  override(DiscussionControls as any, 'renameAction' as any, function (this: Discussion, original: (...args: any[]) => unknown, ...args: any[]) {
    return withOriginal(() => original(...args));
  });

  // O Post do core só se redesenha quando o modelo muda (SubtreeRetainer):
  // alternar original/tradução também precisa contar como mudança.
  extend(CommentPost.prototype, 'oninit', function (this: CommentPost) {
    (this as any).subtree?.check(() => {
      const post = this.attrs.post;
      const discussion = post.number() === 1 ? post.discussion() : null;
      const title = discussion ? `${showing('d', discussion.id())}:${!!titleTranslation(discussion)}` : '';

      return `${showing('p', post.id())}:${!!postTranslation(post)}:${working.has(post.id()!)}:${title}`;
    });
  });

  extend(CommentPost.prototype, 'oncreate', function (this: CommentPost) {
    enqueue('p', this.attrs.post);
  });

  extend(CommentPost.prototype, 'onupdate', function (this: CommentPost) {
    enqueue('p', this.attrs.post);
  });

  // O 文A à esquerda da data (a ordem visual é do LESS). Na primeira postagem
  // ele vale também para o título do tópico: um ícone só, perto do que mudou,
  // em vez de outro solto na ponta da linha do título.
  extend(CommentPost.prototype, 'headerItems', function (this: CommentPost, items: ItemList<Mithril.Children>) {
    const post = this.attrs.post;

    if (!info() || (this as any).isEditing?.()) return;

    const discussion = post.number() === 1 ? post.discussion() : null;
    const title = discussion && titleTranslation(discussion) ? discussion : null;
    const keys: string[] = [];

    if (postTranslation(post)) keys.push(`p${post.id()}`);
    if (title) keys.push(`d${title.id()}`);

    if (keys.length) {
      const [kind, id, locale]: [Kind, string, string | null] = postTranslation(post)
        ? ['p', post.id()!, post.attribute<string>('canelaLocale')]
        : ['d', title!.id()!, title!.attribute<string>('canelaTitleLocale')];

      items.add('canelaTranslated', indicator(kind, id, locale, keys), 1);
    } else if (working.has(post.id()!)) {
      items.add('canelaTranslated', translating(), 1);
    }
  });

  extend(DiscussionHero.prototype, 'oncreate', function (this: DiscussionHero) {
    enqueue('d', this.attrs.discussion);
  });

  extend(DiscussionListItem.prototype, 'oncreate', function (this: DiscussionListItem) {
    if (info()?.titles) enqueue('d', this.attrs.discussion);
  });

  // O 文A do topo da linha do tempo, como no Discourse: abre as
  // "Preferências de idioma do conteúdo" (idioma da interface, os que a
  // pessoa entende e a tradução automática). Cada postagem continua com o
  // 文A dela, que alterna só aquela.
  extend('flarum/forum/components/DiscussionPage' as any, 'sidebarItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!info() || !this.discussion) return;

    const label = app.translator.trans('ramon-canela.forum.ai.translation.prefs.title') as string;

    items.add(
      'canelaContentLanguage',
      <Tooltip text={label}>
        <Button
          className={classList('Button Button--icon CanelaTranslationToggle', { active: autoTranslate() })}
          icon="fas fa-language"
          aria-label={label}
          onclick={() => app.modal.show(() => import('./ContentLanguageModal'))}
        />
      </Tooltip>,
      79
    );
  });
}
