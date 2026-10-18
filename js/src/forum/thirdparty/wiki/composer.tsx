/*
 * O composer do artigo da wiki, como o "Novo tópico" do tema: abre embaixo da
 * tela, na página em que se está, sem levar a /wiki/new.
 *
 * Tem tudo o que o formulário da wiki tinha: a categoria, o título, o texto
 * (com a barra do editor e a prévia ao lado do tema), "Salvar como rascunho"
 * e um painel "Opções avançadas" recolhível e rolável com o endereço (slug),
 * a posição e as perguntas frequentes. Salva pela mesma API da página da
 * extensão (o recurso `linkrobins-wiki-articles` do store).
 *
 * O ComposerBody do core vem num chunk sob demanda: a classe é montada na
 * primeira abertura, a partir do módulo carregado.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import ComposerActionTitle from '../../composer/ComposerActionTitle';
import { t } from '../../utils/settings';
import { thirdParty } from '../settings';
import { categoryChooser, ensureCategories } from './categories';
import { wikiArticleUrl, wt } from './shared';

const COMPOSER_BODY = 'flarum/forum/components/ComposerBody';

const wtr = (key: string, params: Record<string, unknown> = {}) => t(`thirdparty.wiki.${key}`, params);

/** Uma pergunta frequente sendo editada (`uid` só para a key do Mithril). */
interface FaqEntry {
  uid: number;
  question: string;
  answer: string;
}

/** O que o composer edita além do texto (o texto mora no ComposerState). */
export interface ArticleDraft {
  title: string;
  categoryId: string;
  slug: string;
  position: string;
  isDraft: boolean;
  faq: FaqEntry[];
  optionsOpen: boolean;
}

let faqUid = 0;

function draftFrom(article: any): ArticleDraft {
  const read = <T,>(fn: () => T, fallback: T): T => {
    try {
      return fn() ?? fallback;
    } catch {
      return fallback;
    }
  };

  const position = read(() => article?.position?.(), null);
  const category = read(() => article?.category?.(), null);

  return {
    title: read(() => article?.title?.(), '') || '',
    categoryId: category ? String(category.id()) : '',
    slug: read(() => article?.slug?.(), '') || '',
    position: position === null || position === undefined ? '' : String(position),
    isDraft: !!read(() => article?.isDraft?.(), false),
    faq: (read(() => article?.faq?.(), []) || []).map((entry: any) => ({
      uid: faqUid++,
      question: entry?.question || '',
      answer: entry?.answer || '',
    })),
    optionsOpen: false,
  };
}

function showError(message: string): void {
  app.alerts.show({ type: 'error' }, message);
}

/** A mensagem do servidor (slug repetido, por exemplo), ou a genérica. */
function errorDetail(error: any): string {
  try {
    const detail = error?.response?.errors?.[0]?.detail;

    if (detail) return String(detail);
  } catch {
    // Sem corpo de erro legível: a mensagem genérica serve.
  }

  return wt('errors.submit', 'Could not save the article.');
}

function input(value: string, onchange: (value: string) => void, attrs: Record<string, unknown> = {}): Mithril.Children {
  return <input className="FormControl" value={value} oninput={(e: InputEvent) => onchange((e.target as HTMLInputElement).value)} {...attrs} />;
}

function field(label: string, control: Mithril.Children, help?: string): Mithril.Children {
  return (
    <div className="CanelaWikiComposerOptions-field">
      <label className="CanelaWikiComposerOptions-label">{label}</label>
      {control}
      {help ? <p className="CanelaWikiComposerOptions-help">{help}</p> : null}
    </div>
  );
}

/**
 * Abrir o painel faz o composer crescer o tanto do painel (até a altura da
 * janela), para o editor não sumir; fechar devolve a altura de antes. O
 * Composer do core aplica `height` a cada redesenho.
 */
let heightBeforeOptions: number | null = null;

function toggleOptions(draft: ArticleDraft): void {
  const composer: any = app.composer;

  draft.optionsOpen = !draft.optionsOpen;

  if (composer.position !== 'normal') return;

  if (draft.optionsOpen) {
    heightBeforeOptions = composer.height ?? null;
    composer.height = Math.min(window.innerHeight - 64, Number(composer.computedHeight()) + 240);
  } else if (heightBeforeOptions !== null) {
    composer.height = heightBeforeOptions;
    heightBeforeOptions = null;
  }
}

/** A linha "☐ Salvar como rascunho · ⚙ Opções avançadas" e o painel que ela abre. */
function optionsRow(draft: ArticleDraft, disabled: boolean): Mithril.Children {
  const extras = (draft.slug.trim() ? 1 : 0) + (draft.position.trim() ? 1 : 0) + draft.faq.filter((entry) => entry.question.trim()).length;

  return (
    <div className={classList('CanelaWikiComposerOptions', { 'is-open': draft.optionsOpen })}>
      <div className="CanelaWikiComposerOptions-bar">
        <label className="CanelaWikiComposerOptions-draft" title={wt('compose.draft_help', '')}>
          <input
            type="checkbox"
            checked={draft.isDraft}
            disabled={disabled}
            onchange={(e: Event) => {
              draft.isDraft = (e.target as HTMLInputElement).checked;
            }}
          />
          <Icon name="fas fa-file-pen" />
          {wt('compose.draft_label', 'Save as a draft')}
        </label>
        <button
          type="button"
          className="Button--ua-reset CanelaWikiComposerOptions-toggle"
          aria-expanded={draft.optionsOpen ? 'true' : 'false'}
          onclick={() => toggleOptions(draft)}
        >
          <Icon name="fas fa-gear" />
          {wtr('advanced')}
          {extras > 0 ? <span className="CanelaWikiComposerOptions-count">{extras}</span> : null}
          <Icon name={draft.optionsOpen ? 'fas fa-angle-up' : 'fas fa-angle-down'} className="CanelaWikiComposerOptions-caret" />
        </button>
      </div>

      {draft.optionsOpen ? (
        <div className="CanelaWikiComposerOptions-panel">
          <div className="CanelaWikiComposerOptions-grid">
            {field(
              wt('compose.slug_label', 'URL slug'),
              input(draft.slug, (value) => (draft.slug = value), {
                disabled,
                placeholder: wt('compose.slug_placeholder', 'e.g. getting-started'),
              }),
              wt('compose.slug_help', '')
            )}
            {field(
              wt('compose.position_label', 'Position'),
              input(draft.position, (value) => (draft.position = value), {
                type: 'number',
                disabled,
                placeholder: wt('compose.position_placeholder', 'e.g. 1'),
              }),
              wt('compose.position_help', '')
            )}
          </div>

          <div className="CanelaWikiComposerOptions-faq">
            <div className="CanelaWikiComposerOptions-faqHead">
              <span className="CanelaWikiComposerOptions-label">{wt('compose.faq_heading', 'FAQ')}</span>
              <span className="CanelaWikiComposerOptions-help">{wt('compose.faq_help', '')}</span>
            </div>
            <div className="CanelaWikiComposerOptions-faqList">
              {draft.faq.map((entry, index) => (
                <div key={`faq-${entry.uid}`} className="CanelaWikiComposerOptions-faqEntry">
                  {input(entry.question, (value) => (entry.question = value), {
                    disabled,
                    placeholder: wt('compose.faq_question_placeholder', 'Question'),
                  })}
                  <textarea
                    className="FormControl"
                    rows={2}
                    value={entry.answer}
                    disabled={disabled}
                    placeholder={wt('compose.faq_answer_placeholder', 'Answer')}
                    oninput={(e: InputEvent) => {
                      entry.answer = (e.target as HTMLTextAreaElement).value;
                    }}
                  />
                  <Button
                    className="Button Button--icon Button--flat CanelaWikiComposerOptions-faqRemove"
                    icon="fas fa-trash"
                    disabled={disabled}
                    title={wt('compose.faq_remove', 'Remove question')}
                    aria-label={wt('compose.faq_remove', 'Remove question')}
                    onclick={() => draft.faq.splice(index, 1)}
                  />
                </div>
              ))}
            </div>
            <Button
              className="Button CanelaWikiComposerOptions-faqAdd"
              icon="fas fa-plus"
              disabled={disabled}
              onclick={() => draft.faq.push({ uid: faqUid++, question: '', answer: '' })}
            >
              {wt('compose.faq_add', 'Add question')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

let ArticleComposer: any = null;

function makeArticleComposer(ComposerBody: any): any {
  return class WikiArticleComposer extends ComposerBody {
    static initAttrs(attrs: any) {
      super.initAttrs?.(attrs);

      const editing = !!attrs.article;

      attrs.submitLabel = editing ? wt('compose.submit_update', 'Save changes') : wt('compose.submit_create', 'Publish article');
      attrs.placeholder = attrs.placeholder || wt('compose.body_placeholder', 'Write the article. Markdown is supported.');
      attrs.confirmExit = attrs.confirmExit || wt('compose.discard_confirm', 'You have an unsaved article. Discard it?');
      attrs.className = classList(attrs.className, 'CanelaWikiComposer');
    }

    get draft(): ArticleDraft {
      return this.attrs.wikiDraft;
    }

    headerItems() {
      const items: ItemList<Mithril.Children> = super.headerItems();
      const draft = this.draft;
      const editing = !!this.attrs.article;
      const disabled = !!this.loading;

      items.add(
        'title',
        <ComposerActionTitle
          kind="wiki"
          label={editing ? wt('compose.title_edit', 'Edit article') : wt('compose.title', 'New article')}
          icon={editing ? 'fas fa-pencil' : 'fas fa-book-open'}
          title={() => draft.title}
        />,
        1000
      );

      const chooser = categoryChooser(
        draft.categoryId,
        (id) => {
          draft.categoryId = id;
        },
        'CanelaComposerFields-cell CanelaComposerFields-category',
        disabled
      );

      if (chooser) items.add('tags', <div className="CanelaComposerFields">{chooser}</div>, 500);

      items.add(
        'discussionTitle',
        <h3>
          <input
            className="FormControl DiscussionComposer-title"
            value={draft.title}
            disabled={disabled}
            placeholder={wt('compose.title_placeholder', 'Article title')}
            aria-label={wt('compose.title_label', 'Title')}
            oninput={(e: InputEvent) => {
              draft.title = (e.target as HTMLInputElement).value;
            }}
          />
        </h3>,
        100
      );

      items.add('canelaWikiOptions', optionsRow(draft, disabled), 50);

      return items;
    }

    hasChanges(): boolean {
      return super.hasChanges() || this.draft.title !== this.attrs.originalTitle;
    }

    onsubmit() {
      const draft = this.draft;
      const title = draft.title.trim();
      const content = String(this.composer.fields.content() || '').trim();

      if (!title) return showError(wt('errors.title_required', 'Please enter a title.'));
      if (!content) return showError(wt('errors.empty_body', 'Please write the article body before submitting.'));

      const positionRaw = draft.position.trim();
      const category = draft.categoryId ? app.store.getById('linkrobins-wiki-categories' as any, draft.categoryId) || null : null;
      const data = {
        title,
        slug: draft.slug.trim(),
        // Em branco tira a ordem manual (0 seria "primeiro").
        position: positionRaw === '' ? null : parseInt(positionRaw, 10),
        isDraft: !!draft.isDraft,
        faq: draft.faq
          .map((entry) => ({ question: entry.question.trim(), answer: entry.answer.trim() }))
          .filter((entry) => entry.question && entry.answer),
        content,
        relationships: { category },
      };

      this.loading = true;
      m.redraw();

      const record = this.attrs.article || app.store.createRecord('linkrobins-wiki-articles' as any);

      record
        .save(data)
        .then((saved: any) => {
          this.composer.hide();
          m.route.set(wikiArticleUrl(saved));
        })
        .catch((error: any) => {
          this.loaded();
          showError(errorDetail(error));
        });
    }
  };
}

async function articleComposerClass(): Promise<any> {
  if (ArticleComposer) return ArticleComposer;

  const module = await flarum.reg.asyncModuleImport(COMPOSER_BODY);
  const base = module?.default || module;

  ArticleComposer = base ? makeArticleComposer(base) : null;

  return ArticleComposer;
}

/**
 * Abre o composer do artigo: novo (sem `article`) ou editando. `article`
 * pode ser o modelo ou o id/slug; na edição o artigo vem de novo do
 * servidor, com o texto de origem (a lista não traz o `content`).
 */
export async function openArticleComposer(article: any = null): Promise<void> {
  // Um texto em andamento noutro composer: pergunta antes de trocar.
  if (app.composer.isVisible() && app.composer.preventExit && app.composer.preventExit()) return;

  ensureCategories();

  let model = article;

  if (article) {
    const id = typeof article === 'object' ? article.id() : String(article);

    try {
      model = await app.store.find('linkrobins-wiki-articles' as any, id, { include: 'user,category,lastEditedBy' } as any);
    } catch {
      showError(wt('errors.load_article', 'Could not load this article.'));
      return;
    }
  }

  const Composer = await articleComposerClass();

  if (!Composer) return showError(wt('errors.unknown', 'Unknown error.'));

  const draft = draftFrom(model);

  await app.composer.load(Composer, {
    user: app.session.user,
    article: model || null,
    wikiDraft: draft,
    originalTitle: draft.title,
    originalContent: model ? String(model.content?.() || '') : '',
  });

  app.composer.show();
}

/**
 * O composer de comentário da wiki (o ComposerBody dela) ganha a linha da
 * ação, como a resposta de um tópico. A wiki lê `attrs.wikiHeaderItems`
 * depois do headerItems do ComposerBody, então trocar aqui vale para o
 * desenho.
 */
export function installCommentComposer(): void {
  extend(COMPOSER_BODY as any, 'headerItems', function (this: any) {
    const context = String(this.attrs?.wikiContext || '');

    if (!context.startsWith('comment-') || !thirdParty.wiki()) return;

    const editing = context.startsWith('comment-edit-');

    this.attrs.wikiHeaderItems = () => [
      {
        name: 'title',
        priority: 1000,
        content: (
          <ComposerActionTitle
            kind="wikiComment"
            label={editing ? wtr('comment_edit') : wtr('comment_action')}
            icon={editing ? 'fas fa-pencil' : 'fas fa-reply'}
          />
        ),
      },
    ];
  });
}
