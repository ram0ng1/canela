/*
 * #categoria e #etiqueta.
 *
 * No editor: digitar `#` sugere as tags (com o símbolo colorido da categoria)
 * e insere um link markdown `[#nome](endereço da tag)`. Com o flarum/mentions
 * e o flarum/tags ligados, o `#` já é dele — ele sugere as tags e grava uma
 * menção de tag —, e o tema não abre um segundo menu no mesmo gatilho.
 *
 * Nos posts: os links para uma tag cujo texto começa com `#` (os do tema) e as
 * menções de tag do flarum/mentions viram a pílula de hashtag,
 * com o símbolo da categoria ou o ícone de etiqueta.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import TextEditor from 'flarum/common/components/TextEditor';
import Icon from 'flarum/common/components/Icon';
import CommentPost from 'flarum/forum/components/CommentPost';
import highlight from 'flarum/common/helpers/highlight';

import Autocomplete from './Autocomplete';
import { composerOn } from './common';
import { normalize } from './emoji/emojiUtils';
import { allTags, categorySymbol, isTagsEnabled, sortTags, tagUrl, type CanelaTag } from '../../utils/tags';
import { isExtensionEnabled, t } from '../../utils/settings';
import { iconMarkup } from '../../icons';

declare const s9e: { TextFormatter: { preview: (text: string, element: HTMLElement) => void } } | undefined;

const SUGGESTION_LIMIT = 8;

/** O flarum/mentions já cuida do `#` quando as duas extensões estão ligadas. */
function mentionsOwnsHash(): boolean {
  return isExtensionEnabled('flarum-mentions') && isTagsEnabled();
}

function absoluteUrl(path: string): string {
  const origin = app.forum.attribute<string>('baseOrigin') || window.location.origin;

  return /^https?:\/\//.test(path) ? path : origin + path;
}

function suggestTags(typed: string): CanelaTag[] {
  const query = normalize(typed);
  const visible = allTags();
  const starts = (tag: CanelaTag) => normalize(tag.name()).startsWith(query) || tag.slug().startsWith(query);
  const contains = (tag: CanelaTag) => normalize(tag.name()).includes(query);

  // Categorias antes das etiquetas, e quem começa pelo digitado antes de
  // quem só o contém.
  const ranked = [...sortTags(visible.filter(starts)), ...sortTags(visible.filter((tag) => !starts(tag) && contains(tag)))];

  return ranked.slice(0, SUGGESTION_LIMIT);
}

export default function installHashtags() {
  extend(TextEditor.prototype as any, 'buildEditorParams', function (this: TextEditor, params: any) {
    if (!composerOn('Hashtags') || !isTagsEnabled() || mentionsOwnsHash()) return;

    const autocomplete = new Autocomplete(this, {
      className: 'CanelaAutocomplete--hashtag',
      trigger: '#',
      validBit: /[-_\p{L}\p{N}\p{M}]/u,
      suggest: (typed) =>
        suggestTags(typed).map((tag) => {
          const parent = tag.isChild() ? (tag.parent() as CanelaTag | null) : null;

          return {
            key: tag.id() || tag.slug(),
            replacement: `[#${tag.name()}](${absoluteUrl(tagUrl(tag))})`,
            label: (
              <>
                {tag.position() !== null ? categorySymbol(tag) : <Icon name="fas fa-tag" className="CanelaHashtag-tagIcon" />}
                <span className="CanelaAutocomplete-label">{typed ? highlight(tag.name(), typed) : tag.name()}</span>
                {parent && <span className="CanelaAutocomplete-meta">{parent.name()}</span>}
              </>
            ),
          };
        }),
      header: () => t('composer.hashtags.autocomplete_header'),
    });

    (this as any).canelaHashtagAutocomplete = autocomplete;
    params.inputListeners.push(autocomplete.listener);
  });

  extend(TextEditor.prototype as any, 'onbuild', function (this: TextEditor) {
    (this as any).canelaHashtagAutocomplete?.attach();
  });

  // O conteúdo do post é HTML pronto do servidor: a pílula entra depois de
  // ele chegar ao DOM, e de novo a cada atualização (edição, tempo real).
  extend(CommentPost.prototype, ['oncreate', 'onupdate'], function (this: CommentPost) {
    if (!composerOn('Hashtags')) return;

    const body = this.element?.querySelector<HTMLElement>('.Post-body');

    if (body) decorateHashtags(body);
  });

  // A prévia do composer é desenhada pelo formatador em JS, a cada mudança.
  if (typeof s9e !== 'undefined' && s9e?.TextFormatter) {
    override(s9e.TextFormatter as any, 'preview', function (original: any, ...args: any[]) {
      const [text, element] = args as [string, HTMLElement];

      original(text, element);

      if (composerOn('Hashtags')) decorateHashtags(element);
    });
  }
}

/** A tag do link, pelo slug no fim do endereço `/t/<slug>`. */
function tagFromHref(href: string): CanelaTag | null {
  const match = /\/t\/([^/?#]+)\/?(?:[?#].*)?$/.exec(href);

  if (!match) return null;

  const slug = decodeURIComponent(match[1]).toLowerCase();

  return allTags().find((tag) => tag.slug().toLowerCase() === slug) || null;
}

export function decorateHashtags(root: HTMLElement): void {
  if (!isTagsEnabled()) return;

  root.querySelectorAll<HTMLAnchorElement>('a.TagMention, a[href*="/t/"]').forEach((link) => {
    if (link.dataset.canelaHashtag) return;

    const isMention = link.classList.contains('TagMention');

    // Um link qualquer para /t/ só conta quando aponta para este fórum: o
    // mesmo slug em outro site é outra tag.
    if (!isMention && (link.origin !== window.location.origin || !(link.textContent || '').trim().startsWith('#'))) return;

    const tag = tagFromHref(link.getAttribute('href') || '');

    if (!tag) return;

    link.dataset.canelaHashtag = '1';
    link.classList.add('CanelaHashtag', tag.position() !== null ? 'CanelaHashtag--category' : 'CanelaHashtag--tag');

    // O nome sem o "#": o símbolo é que faz esse papel.
    const label = document.createElement('span');
    label.className = 'CanelaHashtag-name';
    label.textContent = tag.name();

    const symbol = document.createElement('span');
    symbol.className = 'CanelaHashtag-symbol';

    if (tag.position() !== null) {
      m.render(symbol, categorySymbol(tag));
    } else {
      symbol.innerHTML = iconMarkup('fas fa-tag');
    }

    link.replaceChildren(symbol, label);
    link.title ||= tag.description() || tag.name();
  });
}
