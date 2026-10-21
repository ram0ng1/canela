import Modal from 'flarum/common/components/Modal';
import Stream from 'flarum/common/utils/Stream';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { SHORTCUT_GROUPS, type Shortcut } from '../shell/shortcuts';

/** Os nomes das teclas como aparecem nas pílulas de atalho. */
const KEY_NAMES: Record<string, string> = {
  shift: 'Shift',
  ctrl: 'Ctrl',
  alt: 'Alt',
  meta: 'Meta',
  enter: 'Enter',
  home: 'Home',
  end: 'End',
  esc: 'Esc',
};

/** "g h" → ["G", "H"]; "shift+j" → ["Shift", "J"]. */
function keyParts(combo: string): string[] {
  return combo
    .split(/[\s+]+/)
    .filter(Boolean)
    .map((key) => KEY_NAMES[key.toLowerCase()] || (key.length === 1 ? key.toUpperCase() : key));
}

/**
 * A janela de atalhos, aberta pela
 * tecla "?": o campo de busca no topo e, em duas colunas, uma caixa por grupo
 * com a descrição à esquerda e as teclas em pílulas à direita. O corpo rola
 * dentro do modal (80% da altura), em vez de empurrar a página.
 */
export default class KeyboardShortcutsModal extends Modal {
  filter = Stream('');

  className() {
    return 'CanelaShortcutsModal Modal--large';
  }

  title() {
    return t('shortcuts.title');
  }

  onready() {
    this.$('.CanelaShortcuts-filter').trigger('focus');
  }

  matches(shortcut: Shortcut, needle: string): boolean {
    if (!needle) return true;

    const label = String(t(`shortcuts.actions.${shortcut.action}`)).toLowerCase();
    const keys = shortcut.keys.map((combo) => keyParts(combo).join(' ').toLowerCase());

    return label.includes(needle) || keys.some((combo) => combo.includes(needle));
  }

  content(): Mithril.Children {
    const needle = this.filter().trim().toLowerCase();
    const groups = SHORTCUT_GROUPS.map((group) => ({
      ...group,
      shortcuts: group.shortcuts.filter((shortcut) => this.matches(shortcut, needle)),
    })).filter((group) => group.shortcuts.length > 0);

    return (
      <div className="Modal-body">
        <div className="CanelaShortcuts-search">
          <input className="FormControl CanelaShortcuts-filter" type="search" bidi={this.filter} placeholder={t('shortcuts.search_placeholder')} />
        </div>
        {groups.length ? (
          <div className="CanelaShortcuts">
            {groups.map((group) => (
              <section className="CanelaShortcuts-group">
                <h4>{t(`shortcuts.groups.${group.name}`)}</h4>
                <table>
                  <tbody>
                    {group.shortcuts.map((shortcut) => (
                      <tr>
                        <td className="CanelaShortcuts-label">{t(`shortcuts.actions.${shortcut.action}`)}</td>
                        <td className="CanelaShortcuts-keys">
                          {shortcut.keys.map((combo, index) => [
                            index > 0 && (
                              <span className="CanelaShortcuts-or">{/next_prev|first_last/.test(shortcut.action) ? '/' : t('shortcuts.or')}</span>
                            ),
                            <kbd className="CanelaShortcuts-kbd">
                              {keyParts(combo).map((key) => (
                                <span className="CanelaShortcuts-key">{key}</span>
                              ))}
                            </kbd>,
                          ])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        ) : (
          <p className="CanelaShortcuts-empty">{t('shortcuts.no_results')}</p>
        )}
      </div>
    );
  }
}
