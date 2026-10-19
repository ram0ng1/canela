/*
 * O modal de tags do flarum/tags (`TagSelectionModal` e o `TagDiscussionModal`
 * que o estende: "Editar tags", o controle da discussão, a seleção em massa)
 * desenhado como o seletor de tags do composer do tema: o campo de busca é um
 * `.FormControl` com as escolhidas em pílulas (símbolo, nome, ×), a lista tem
 * o símbolo na cor da tag, o nome na cor do texto, a descrição embaixo e o
 * check à direita, separada em "Tags primárias" e "Tags secundárias", e o
 * rodapé leva o "Ignorar requisitos" (switch) à esquerda e o botão à direita.
 *
 * Só o desenho muda: filtro, limites, permissões, `requireParentTag`, o
 * teclado (↑ ↓ Enter, Ctrl+Enter, Backspace) e o envio continuam sendo os
 * métodos do flarum/tags, chamados daqui. Os dois módulos vêm num pedaço
 * carregado sob demanda: estendidos pelo nome.
 */
import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Switch from 'flarum/common/components/Switch';
import classList from 'flarum/common/utils/classList';
import extractText from 'flarum/common/utils/extractText';
import highlight from 'flarum/common/helpers/highlight';
import type Mithril from 'mithril';

import { categorySymbol, type CanelaTag } from '../utils/tags';
import { isExtensionEnabled, t } from '../utils/settings';

const SELECTION = 'ext:flarum/tags/common/components/TagSelectionModal';
const DISCUSSION = 'ext:flarum/tags/forum/components/TagDiscussionModal';

/** Mesma regra do flarum/tags: um caractere CJK ocupa 2ch. */
function textWidth(modal: any, text: string): number {
  return typeof modal.lengthWithCJK === 'function' ? modal.lengthWithCJK(text) : text.length;
}

/** A pílula de uma tag escolhida; clicar tira a tag (como no flarum/tags). */
function chip(modal: any, tag: CanelaTag): Mithril.Children {
  return (
    <button
      type="button"
      className="CanelaSelectKit-chip CanelaTagModal-chip"
      title={t('composer.shell.remove_tag')}
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        modal.removeTag(tag);
        modal.onready();
      }}
    >
      {categorySymbol(tag)}
      <span className="CanelaTagModal-chipName">{tag.name()}</span>
      <Icon name="fas fa-xmark" />
    </button>
  );
}

/** Uma linha da lista: símbolo, nome, descrição e o check da escolhida. */
function row(modal: any, tag: CanelaTag, filter: string): Mithril.Children {
  const selected = modal.selected.includes(tag);
  const description = tag.description();

  return (
    <li
      data-index={tag.id()}
      role="option"
      aria-selected={selected ? 'true' : 'false'}
      className={classList('SelectTagListItem CanelaTagList-item', {
        pinned: tag.position() !== null,
        child: !!tag.parent(),
        colored: !!tag.color(),
        selected,
        active: modal.indexTag === tag,
      })}
      onmouseover={() => (modal.indexTag = tag)}
      onclick={() => modal.toggleTag(tag)}
    >
      <span className="CanelaTagList-symbol">{categorySymbol(tag)}</span>
      <span className="CanelaTagList-text">
        <span className="CanelaTagList-name">{highlight(tag.name(), filter)}</span>
        {description ? <span className="CanelaTagList-desc">{description}</span> : null}
      </span>
      <Icon name="fas fa-check" className="CanelaTagList-check" />
    </li>
  );
}

/**
 * A lista com os rótulos de seção. As fixadas (`position`) são as primárias e
 * as filhas delas, que o `sortTags` já põe antes das secundárias; o rótulo só
 * aparece quando há dos dois tipos. Os rótulos não têm `data-index`, e o
 * `selectableItems` abaixo os deixa fora da navegação por teclado.
 */
function list(modal: any, tags: CanelaTag[], filter: string): Mithril.Children[] {
  const pinned = tags.filter((tag) => tag.position() !== null);
  const others = tags.filter((tag) => tag.position() === null);
  const sections = pinned.length > 0 && others.length > 0;
  const items: Mithril.Children[] = [];

  tags.forEach((tag, i) => {
    if (sections && (i === 0 || (tag.position() === null && tags[i - 1].position() !== null))) {
      items.push(
        <li className="CanelaTagList-heading" role="presentation">
          {t(tag.position() !== null ? 'tag_modal.primary_heading' : 'tag_modal.secondary_heading')}
        </li>
      );
    }

    items.push(row(modal, tag, filter));
  });

  return items;
}

function content(modal: any): Mithril.Children {
  if (modal.loading || !modal.tags) {
    return <LoadingIndicator />;
  }

  const filter = modal.filter().toLowerCase();
  const primaryCount = modal.primaryCount();
  const secondaryCount = modal.secondaryCount();
  const tags: CanelaTag[] = modal.getFilteredTags();
  const instruction = extractText(modal.getInstruction(primaryCount, secondaryCount));
  const placeholder = instruction || t('composer.shell.search_placeholder');
  const inputWidth = Math.max(textWidth(modal, placeholder), textWidth(modal, modal.filter()));

  return [
    <div className="Modal-body CanelaTagModal-body">
      <div
        className={classList('TagsInput FormControl CanelaTagModal-input', { focus: modal.focused })}
        onclick={() => modal.$('.TagsInput input').focus()}
      >
        {modal.selected.map((tag: CanelaTag) => chip(modal, tag))}
        <input
          className="CanelaTagModal-search"
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-label={placeholder}
          placeholder={placeholder}
          bidi={modal.filter}
          style={{ flexBasis: inputWidth + 2 + 'ch' }}
          // As tags chegam depois do `onready` do modal, que não acha o campo:
          // o foco vai para a busca quando ela aparece (no celular não, para
          // não abrir o teclado por cima da lista).
          oncreate={(vnode: Mithril.VnodeDOM) => {
            if (app.screen() !== 'phone') (vnode.dom as HTMLInputElement).focus();
          }}
          onkeydown={modal.navigator.navigate.bind(modal.navigator)}
          onfocus={() => (modal.focused = true)}
          onblur={() => (modal.focused = false)}
        />
      </div>

      {tags.length ? (
        <ul className="TagSelectionModal-list CanelaTagList" role="listbox" aria-multiselectable="true">
          {list(modal, tags, filter)}
        </ul>
      ) : (
        <div className="CanelaTagList-empty">{t('composer.shell.no_results')}</div>
      )}
    </div>,

    <div className="Modal-footer CanelaTagModal-footer">
      {modal.attrs.limits?.allowBypassing ? (
        <Switch className="CanelaTagModal-bypass" state={modal.bypassReqs} onchange={(value: boolean) => (modal.bypassReqs = value)}>
          {app.translator.trans('flarum-tags.lib.tag_selection_modal.bypass_requirements')}
        </Switch>
      ) : null}
      <Button
        type="submit"
        className="Button Button--primary CanelaTagModal-submit"
        disabled={!modal.meetsRequirements(primaryCount, secondaryCount)}
      >
        {app.translator.trans('flarum-tags.lib.tag_selection_modal.submit_button')}
      </Button>
    </div>,
  ];
}

export default function installTagModal(): void {
  if (!isExtensionEnabled('flarum-tags')) return;

  // `className` devolve texto: só um override consegue somar a classe.
  override(SELECTION as any, 'className', function (this: any, original: () => string) {
    return classList(original(), 'CanelaTagModal');
  });

  // O desenho todo; se algo der errado aqui, volta o do flarum/tags.
  override(SELECTION as any, 'content', function (this: any, original: () => Mithril.Children) {
    try {
      return content(this);
    } catch (e) {
      console.error(e);
      return original();
    }
  });

  // Os rótulos de seção ficam fora da navegação por ↑ ↓.
  override(SELECTION as any, 'selectableItems', function (this: any) {
    return this.$('.TagSelectionModal-list > li[data-index]');
  });

  // "Editar tags" numa linha e o título da discussão embaixo, menor e cinza,
  // em vez de "Editar Tags de <título>" em duas linhas grandes.
  override(DISCUSSION as any, 'title', function (this: any, original: () => Mithril.Children) {
    const discussion = this.attrs?.discussion;

    if (!discussion) return original();

    return [
      <span className="CanelaTagModal-title">{t('tag_modal.edit_title')}</span>,
      <span className="CanelaTagModal-subtitle" title={discussion.title()}>
        {discussion.title()}
      </span>,
    ];
  });
}
