/*
 * Seletor de emoji simples para o status: o botão mostra o emoji atual e abre
 * uma grade com os mais usados em status (os sugeridos pelo Discourse e
 * alguns do dia a dia). Quem quiser outro digita ou cola no campo da grade.
 *
 * Nada de biblioteca de emojis: a grade cobre o caso comum, e o servidor
 * valida qualquer emoji que vier pelo campo livre.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { DEFAULT_STATUS_EMOJI } from './components';

const EMOJIS = [
  '💬',
  '🌴',
  '🏖️',
  '✈️',
  '🏠',
  '🤒',
  '🎉',
  '🎂',
  '📅',
  '🗓️',
  '💼',
  '💻',
  '📚',
  '✍️',
  '🎧',
  '🎮',
  '☕',
  '🍕',
  '🏃',
  '🚴',
  '🧘',
  '😴',
  '🤔',
  '😎',
  '🙂',
  '😊',
  '🥳',
  '😅',
  '🔥',
  '⭐',
  '🚀',
  '🛠️',
  '🚧',
  '🔕',
  '⏳',
  '❤️',
  '👋',
  '👍',
  '🙏',
  '🇧🇷',
];

export interface EmojiPickerAttrs extends ComponentAttrs {
  value: string;
  onchange: (emoji: string) => void;
}

export default class EmojiPicker extends Component<EmojiPickerAttrs> {
  open = false;
  outsideHandler?: (event: Event) => void;

  view() {
    const { value } = this.attrs;

    return (
      <div className={`CanelaStatusPicker${this.open ? ' is-open' : ''}`}>
        <button
          type="button"
          className="Button Button--icon CanelaStatusPicker-toggle"
          aria-haspopup="true"
          aria-expanded={this.open ? 'true' : 'false'}
          aria-label={t('profile.status.choose_emoji')}
          title={t('profile.status.choose_emoji')}
          onclick={() => this.toggle()}
        >
          <span className="CanelaStatusPicker-current">{value || DEFAULT_STATUS_EMOJI}</span>
        </button>

        {this.open && (
          <div className="CanelaStatusPicker-panel" role="dialog" aria-label={t('profile.status.choose_emoji')}>
            <div className="CanelaStatusPicker-grid">
              {EMOJIS.map((emoji) => (
                <button
                  type="button"
                  className={`CanelaStatusPicker-option${emoji === value ? ' is-selected' : ''}`}
                  aria-pressed={emoji === value ? 'true' : 'false'}
                  onclick={() => this.choose(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="CanelaStatusPicker-custom">
              <input
                className="FormControl"
                type="text"
                maxlength={16}
                placeholder={t('profile.status.custom_emoji')}
                aria-label={t('profile.status.custom_emoji')}
                onkeydown={(event: KeyboardEvent) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  this.choose((event.target as HTMLInputElement).value.trim());
                }}
                onchange={(event: Event) => this.choose((event.target as HTMLInputElement).value.trim(), false)}
              />
              <Button className="Button Button--link" onclick={() => this.choose('')}>
                {t('profile.status.no_emoji')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  toggle() {
    this.open = !this.open;
  }

  choose(emoji: string, close = true) {
    this.attrs.onchange(emoji);
    if (close) this.open = false;
  }

  oncreate(vnode: Mithril.VnodeDOM<EmojiPickerAttrs, this>) {
    super.oncreate(vnode);

    // Fecha ao clicar fora ou com Esc, como os dropdowns do core.
    this.outsideHandler = (event: Event) => {
      if (!this.open) return;
      if (event instanceof KeyboardEvent ? event.key !== 'Escape' : this.element.contains(event.target as Node)) return;

      this.open = false;
      m.redraw();
    };

    document.addEventListener('mousedown', this.outsideHandler, true);
    document.addEventListener('keydown', this.outsideHandler, true);
  }

  onremove(vnode: Mithril.VnodeDOM<EmojiPickerAttrs, this>) {
    super.onremove(vnode);

    if (this.outsideHandler) {
      document.removeEventListener('mousedown', this.outsideHandler, true);
      document.removeEventListener('keydown', this.outsideHandler, true);
    }
  }
}
