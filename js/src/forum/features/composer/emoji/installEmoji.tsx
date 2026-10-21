/*
 * O botão de emoji da barra do editor abre o seletor do tema.
 *
 * Com o flarum/emoji ligado, o botão dele (que só digita " :" e abre o
 * autocompletar) dá lugar ao do seletor, na mesma posição; o autocompletar
 * `:sor…` continua sendo o dele — o tema só o estiliza. Sem o flarum/emoji, o
 * tema mesmo oferece o autocompletar, com a mesma lista do seletor, buscando
 * em português e em inglês.
 *
 * O seletor insere o caractere do emoji, e não o atalho `:nome:`: é o que o
 * flarum/emoji também insere e o que ele converte em imagem nos posts — o
 * formatador dele não conhece os atalhos por nome.
 */
import { extend } from 'flarum/common/extend';
import TextEditor from 'flarum/common/components/TextEditor';
import TextEditorButton from 'flarum/common/components/TextEditorButton';
import type Mithril from 'mithril';

import Autocomplete from '../Autocomplete';
import { composerOn, editorDriver, extendToolbarLate } from '../common';
import { openEmojiPicker, preloadEmojiPicker } from './pickerLazy';
import { loadEmojiData, matches, normalize, twemojiUrl, usesTwemoji } from './emojiUtils';
import type { EmojiRow } from '../emoji-data';
import { isExtensionEnabled, t } from '../../../utils/settings';

const AUTOCOMPLETE_LIMIT = 12;

export default function installEmoji() {
  extendToolbarLate(function (items) {
    if (!composerOn('Emoji')) return;

    const priority = items.has('emoji') ? items.getPriority('emoji') : 0;

    items.add(
      'emoji',
      <TextEditorButton
        icon="far fa-face-smile"
        className="Button Button--icon Button--link CanelaEmojiButton"
        onmouseenter={preloadEmojiPicker}
        onfocus={preloadEmojiPicker}
        onclick={(e: MouseEvent) => {
          const driver = editorDriver(this);

          openEmojiPicker(e.currentTarget as HTMLElement, (emoji) => driver?.insertAtCursor(emoji, false));
        }}
      >
        {t('composer.emoji.button')}
      </TextEditorButton>,
      priority
    );
  });

  // O autocompletar próprio só existe sem o flarum/emoji: dois menus no
  // mesmo ":" brigariam pelas setas e pelo Enter.
  extend(TextEditor.prototype as any, 'buildEditorParams', function (this: TextEditor, params: any) {
    if (!composerOn('Emoji') || isExtensionEnabled('flarum-emoji')) return;

    const autocomplete = new Autocomplete(this, {
      className: 'CanelaAutocomplete--emoji',
      trigger: ':',
      validBit: /[a-z0-9_+\-À-ɏ]/i,
      lookBehind: 20,
      header: () => t('composer.emoji.autocomplete_header'),
      suggest: (typed) => {
        // Só depois de duas letras, senão ":" num horário
        // ("10:30") ou num emoticon já abriria o menu.
        if (typed.length < 2) return [];

        return loadEmojiData().then((groups) => {
          const terms = [normalize(typed)];
          const found: EmojiRow[] = [];

          // Primeiro os que começam pelo atalho, depois qualquer palavra.
          for (const pass of [
            (row: EmojiRow) => row[1].split(' ').some((code) => code.startsWith(terms[0])),
            (row: EmojiRow) => matches(row, terms),
          ]) {
            for (const group of groups) {
              for (const row of group.emoji) {
                if (found.length >= AUTOCOMPLETE_LIMIT) break;
                if (!found.includes(row) && pass(row)) found.push(row);
              }
            }
          }

          return found.map((row) => ({
            key: row[0],
            replacement: row[0],
            label: suggestionLabel(row),
          }));
        });
      },
    });

    (this as any).canelaEmojiAutocomplete = autocomplete;
    params.inputListeners.push(autocomplete.listener);
  });

  extend(TextEditor.prototype as any, 'onbuild', function (this: TextEditor) {
    (this as any).canelaEmojiAutocomplete?.attach();
  });
}

function suggestionLabel(row: EmojiRow): Mithril.Children {
  const code = row[1].split(' ')[0];

  return (
    <>
      {usesTwemoji() ? (
        <img className="emoji" src={twemojiUrl(row[0])} alt={row[0]} loading="lazy" />
      ) : (
        <span className="CanelaAutocomplete-emoji">{row[0]}</span>
      )}
      <span className="CanelaAutocomplete-label">:{code}:</span>
    </>
  );
}
