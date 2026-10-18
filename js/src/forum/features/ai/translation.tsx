/*
 * Tradução automática do conteúdo (o `ai_translation` do Discourse AI).
 *
 * O servidor manda, junto com cada postagem e tópico, a tradução para o idioma
 * de quem lê (quando já existe) ou a marca `canelaTranslatable` (falta
 * traduzir). A página desenha o original na hora e, logo depois, pede as que
 * faltam em lote (POST /canela/ai/translate) — a leitura nunca espera o modelo.
 *
 * A tradução entra pelo próprio modelo (`contentHtml()` e `title()`), então
 * aparece em todo lugar que mostra o post ou o título; o 文A ao lado da data
 * alterna aquela postagem, e o botão redondo da linha do tempo alterna o
 * tópico inteiro (lembrado neste navegador, como o "mostrar original" do
 * Discourse). Editar o título sempre parte do título original.
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

let allOriginal = readStored();
/** Os itens que a pessoa virou um a um, ao contrário do modo do tópico. */
const flipped = new Set<string>();
/** Ligado enquanto o título original precisa sair do modelo (renomear). */
let bypass = 0;

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function showing(kind: Kind, id: string | undefined): boolean {
  if (bypass > 0 || !id) return false;

  return allOriginal ? flipped.has(`${kind}${id}`) : !flipped.has(`${kind}${id}`);
}

function flip(kind: Kind, id: string): void {
  const key = `${kind}${id}`;

  if (flipped.has(key)) flipped.delete(key);
  else flipped.add(key);

  m.redraw();
}

function setAllOriginal(value: boolean): void {
  allOriginal = value;
  flipped.clear();

  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Navegação privada: vale só nesta página.
  }

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
    const name = new Intl.DisplayNames([app.translator.getLocale() || 'en'], { type: 'language' }).of(code) || code;

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

  const key = versionKey(kind, model);

  if (asked.has(key)) return;

  asked.add(key);

  if (kind === 'p') queue.posts.set(model.id()!, model as Post);
  else queue.discussions.set(model.id()!, model as Discussion);

  schedule(250);
}

function schedule(delay: number): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, delay);
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
    return;
  }

  let pending = false;

  posts.forEach((post) => {
    const result = response?.posts?.[post.id()!];

    if (result?.html) {
      post.pushAttributes({ canelaTranslation: result.html, canelaLocale: result.locale, canelaTranslatable: false });
    } else if (result?.pending) {
      pending = true;
      queue.posts.set(post.id()!, post);
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
  // limite de rodadas segura um servidor que só responde "pendente".
  const more = queue.posts.size > 0 || queue.discussions.size > 0;

  if (more && (!pending || ++rounds <= MAX_ROUNDS)) {
    schedule(pending ? (response?.retryAfter ? response.retryAfter * 1000 : 1500) : 50);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

/** O 文A: tooltip com o idioma original e o aviso; clicar alterna. */
function indicator(kind: Kind, id: string, locale: string | null | undefined): Mithril.Children {
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
        aria-pressed={translated ? 'false' : 'true'}
        aria-label={`${what} ${action}`}
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          flip(kind, id);
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

/** O tópico tem algo traduzido (título ou postagem carregada)? */
function topicHasTranslation(discussion: Discussion): boolean {
  if (titleTranslation(discussion)) return true;

  return app.store.all<Post>('posts').some((post) => post.discussion() === discussion && !!postTranslation(post));
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

      return `${showing('p', post.id())}:${!!postTranslation(post)}`;
    });
  });

  extend(CommentPost.prototype, 'oncreate', function (this: CommentPost) {
    enqueue('p', this.attrs.post);
  });

  extend(CommentPost.prototype, 'onupdate', function (this: CommentPost) {
    enqueue('p', this.attrs.post);
  });

  extend(CommentPost.prototype, 'headerItems', function (this: CommentPost, items: ItemList<Mithril.Children>) {
    const post = this.attrs.post;

    if (!info() || !postTranslation(post) || (this as any).isEditing?.()) return;

    // Antes da data no DOM; a ordem visual (lápis, 文A, data) é do LESS.
    items.add('canelaTranslated', indicator('p', post.id()!, post.attribute<string>('canelaLocale')), 1);
  });

  extend(DiscussionHero.prototype, 'oncreate', function (this: DiscussionHero) {
    enqueue('d', this.attrs.discussion);
  });

  extend(DiscussionHero.prototype, 'items', function (this: DiscussionHero, items: ItemList<Mithril.Children>) {
    const discussion = this.attrs.discussion;

    if (!info() || !discussion || !titleTranslation(discussion) || !items.has('title')) return;

    const title = items.get('title') as any;

    // Durante a edição do título (gaps/topic/titleEditor) não há o que alternar.
    if (title?.tag === 'form') return;

    // No mesmo item do título, para o 文A ficar na linha dele.
    items.setContent(
      'title',
      <div className="CanelaTitleTranslated">
        {title}
        {indicator('d', discussion.id()!, discussion.attribute<string>('canelaTitleLocale'))}
      </div>
    );
  });

  extend(DiscussionListItem.prototype, 'oncreate', function (this: DiscussionListItem) {
    if (info()?.titles) enqueue('d', this.attrs.discussion);
  });

  // O botão redondo da linha do tempo: o tópico inteiro no original, ou traduzido.
  extend('flarum/forum/components/DiscussionPage' as any, 'sidebarItems', function (this: any, items: ItemList<Mithril.Children>) {
    const discussion: Discussion | undefined = this.discussion;

    if (!info() || !discussion || !topicHasTranslation(discussion)) return;

    const label = app.translator.trans(`ramon-canela.forum.ai.translation.${allOriginal ? 'show_translated_all' : 'show_original_all'}`) as string;

    items.add(
      'canelaTranslationToggle',
      <Tooltip text={label}>
        <Button
          className={classList('Button Button--icon CanelaTranslationToggle', { active: allOriginal })}
          icon="fas fa-language"
          aria-label={label}
          aria-pressed={allOriginal ? 'true' : 'false'}
          onclick={() => setAllOriginal(!allOriginal)}
        />
      </Tooltip>,
      79
    );
  });
}
