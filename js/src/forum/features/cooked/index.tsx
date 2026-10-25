/*
 * A sintaxe a mais do conteúdo (extend/cooked.php) no fórum: as notas de
 * rodapé nos posts e na prévia, o sumário na coluna da linha do tempo (e na
 * folha da linha do tempo do celular), e os atalhos "Nota de rodapé" e
 * "Inserir sumário" no menu ⊕ do composer.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { addMoreAction } from '../../composer/installToolbar';
import { t } from '../../utils/settings';
import { decorateFootnotes, footnotesOn } from './footnotes';
import TableOfContents, { tocFor, tocOn, tocToggle, tocVisible } from './toc';

declare const s9e: { TextFormatter: { preview: (text: string, element: HTMLElement) => void } } | undefined;

const EDIT = 'flarum/forum/components/EditPostComposer';
const DISCUSSION = 'flarum/forum/components/DiscussionComposer';

function installFootnotes(): void {
  extend(CommentPost.prototype, ['oncreate', 'onupdate'], function (this: any) {
    const body = this.element?.querySelector?.('.Post-body') as HTMLElement | null;

    if (body) decorateFootnotes(body);
  });

  // A prévia do composer é desenhada pelo formatador em JS, a cada mudança.
  if (typeof s9e !== 'undefined' && s9e?.TextFormatter) {
    override(s9e.TextFormatter as any, 'preview', function (original: any, ...args: any[]) {
      const [text, element] = args as [string, HTMLElement];

      original(text, element);
      decorateFootnotes(element);
    });
  }

  addMoreAction(() => {
    if (!footnotesOn() || !app.composer.isVisible() || !app.composer.editor) return null;

    return {
      key: 'canelaFootnote',
      icon: 'fas fa-asterisk',
      label: t('footnotes.add'),
      onclick: () => app.composer.editor?.insertAtCursor(`^[${t('footnotes.placeholder')}]`, false),
    };
  });
}

/** O primeiro post do que está sendo escrito: a discussão nova ou a edição do post 1. */
function writingFirstPost(): boolean {
  const composer: any = app.composer;

  if (composer.bodyMatches(DISCUSSION)) return true;

  return composer.bodyMatches(EDIT) && composer.body?.attrs?.post?.number?.() === 1;
}

/**
 * A coluna da linha do tempo existe (Topic.less: a partir de 925px). Abaixo
 * disso a linha do tempo é a aba "1 / 11" com a folha, e o sumário vai nela.
 */
function hasColumn(): boolean {
  return window.matchMedia('(min-width: 925px)').matches;
}

function installToc(): void {
  extend(DiscussionPage.prototype, 'sidebarItems', function (this: any, items: ItemList<Mithril.Children>) {
    const toc = hasColumn() ? tocFor(this.discussion) : null;

    document.body.classList.toggle('CanelaToc--active', !!toc && (tocVisible() || (this.discussion?.commentCount?.() || 0) <= 1));

    if (!toc) return;

    const single = (this.discussion.commentCount?.() || 0) <= 1;

    if (single || tocVisible()) {
      if (items.has('scrubber')) items.remove('scrubber');

      items.add('canelaToc', <TableOfContents post={toc.post} tree={toc.tree} stream={this.stream} />, -100);
    }

    if (!single) items.add('canelaTocToggle', tocToggle(), -1000);
  });

  extend(DiscussionPage.prototype, 'onremove', () => document.body.classList.remove('CanelaToc--active'));

  // Sem a coluna (celular e tablet estreito): o sumário dentro da folha da
  // linha do tempo, abaixo do resumo.
  extend('flarum/forum/components/PostStreamScrubber' as any, 'view', function (this: any, vnode: any) {
    if (hasColumn() || !vnode || !Array.isArray(vnode.children)) return;

    const menu = vnode.children.find((child: any) => child && child.attrs && /Dropdown-menu/.test(child.attrs.className || ''));
    const toc = tocFor(this.stream?.discussion);

    if (!menu || !toc || !Array.isArray(menu.children)) return;

    menu.children.push(
      <div className="CanelaToc-sheet">
        <h3>{t('toc.title')}</h3>
        <TableOfContents post={toc.post} tree={toc.tree} stream={this.stream} />
      </div>
    );
  });

  addMoreAction(() => {
    if (!tocOn() || !app.composer.isVisible() || !app.composer.editor || !writingFirstPost()) return null;

    return {
      key: 'canelaToc',
      icon: 'fas fa-list-ul',
      label: t('toc.insert'),
      onclick: () => app.composer.editor?.insertAtCursor('[toc]\n', false),
    };
  });
}

export default function installCooked(): void {
  installFootnotes();
  installToc();
}
