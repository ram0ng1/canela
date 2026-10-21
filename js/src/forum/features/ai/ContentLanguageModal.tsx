/*
 * "Preferências de idioma do conteúdo", o modal do 文A no topo da linha do
 * tempo (o content-localization do Discourse):
 *
 * - o idioma da interface (o mesmo seletor do cabeçalho: muda e recarrega);
 * - os idiomas que a pessoa entende: postagens e títulos neles saem no
 *   original, sem nem pedir a tradução;
 * - "Traduzir automaticamente": desligado, os tópicos abrem no original (o 文A
 *   de cada postagem continua alternando aquela).
 *
 * Nada muda até o Salvar.
 */
import app from 'flarum/forum/app';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';

import SelectKit from '../../composer/SelectKit';
import { chooseLocale } from '../../shell/LocaleSwitcher';
import { displayNames } from '../../utils/intl';
import { autoTranslate, saveContentLanguagePreferences, understoodLocales } from './translation';

/** Os idiomas oferecidos, além dos instalados no fórum e dos já escolhidos. */
const COMMON_LANGUAGES = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'sv', 'tr', 'uk', 'vi', 'zh'];

function tr(key: string, params: Record<string, unknown> = {}): string {
  return app.translator.trans(`ramon-canela.forum.ai.translation.prefs.${key}`, params, true) as string;
}

function languageName(code: string): string {
  try {
    const name = displayNames([app.translator.getLocale() || 'en'], { type: 'language' }).of(code) || code;

    return name.charAt(0).toLocaleUpperCase() + name.slice(1);
  } catch {
    return code;
  }
}

/** "pt_BR" → "pt-BR": o formato do Intl e do que fica salvo. */
function normalize(code: string): string {
  return code.replace('_', '-');
}

export default class ContentLanguageModal extends Modal<IInternalModalAttrs> {
  interfaceLocale = '';
  understood: string[] = [];
  auto = true;
  saving = false;

  oninit(vnode: Mithril.Vnode<IInternalModalAttrs, this>) {
    super.oninit(vnode);

    this.interfaceLocale = ((app.data as any).locale || 'en') as string;
    this.understood = [...understoodLocales()];
    this.auto = autoTranslate();
  }

  className() {
    return 'CanelaContentLanguageModal';
  }

  title() {
    return tr('title');
  }

  languages(): string[] {
    const installed = Object.keys(((app.data as any).locales || {}) as Record<string, string>).map(normalize);
    const all = new Set([...COMMON_LANGUAGES, ...installed, ...this.understood]);

    return Array.from(all).sort((a, b) => languageName(a).localeCompare(languageName(b)));
  }

  toggle(code: string): void {
    this.understood = this.understood.includes(code) ? this.understood.filter((item) => item !== code) : [...this.understood, code];
  }

  content() {
    const locales = ((app.data as any).locales || {}) as Record<string, string>;
    const chosen = this.understood;

    return [
      <div className="Modal-body">
        <div className="Form CanelaContentLanguage">
          {
            <div className="Form-group">
              <label className="CanelaContentLanguage-label" for="canela-interface-locale">
                {tr('interface_language')}
              </label>
              <span className="Select">
                <select
                  id="canela-interface-locale"
                  className="FormControl Select-input"
                  value={this.interfaceLocale}
                  onchange={(event: Event) => (this.interfaceLocale = (event.target as HTMLSelectElement).value)}
                >
                  {Object.entries(locales).map(([code, name]) => (
                    <option value={code}>{name}</option>
                  ))}
                </select>
                <Icon name="fas fa-chevron-down" className="Select-caret" />
              </span>
            </div>
          }

          <div className="Form-group">
            <div className="CanelaContentLanguage-label">{tr('understood_label')}</div>
            <p className="CanelaContentLanguage-help">{tr('understood_help')}</p>
            <SelectKit
              className={`CanelaContentLanguage-understood${chosen.length ? ' has-selection' : ''}`}
              label={tr('understood_label')}
              caret="fas fa-plus"
              caretOpen="fas fa-plus"
              stayOpen
              filterIcon
              header={
                chosen.length ? (
                  <span className="CanelaContentLanguage-value">{chosen.map(languageName).join(', ')}</span>
                ) : (
                  <span className="CanelaContentLanguage-placeholder">{tr('understood_placeholder')}</span>
                )
              }
              before={
                chosen.length ? (
                  <div className="CanelaSelectKit-selected">
                    {chosen.map((code) => (
                      <button
                        type="button"
                        className="CanelaSelectKit-chip"
                        title={tr('remove', { language: languageName(code) })}
                        onmousedown={(e: MouseEvent) => e.preventDefault()}
                        onclick={() => this.toggle(code)}
                      >
                        <span>{languageName(code)}</span>
                        <Icon name="fas fa-xmark" />
                      </button>
                    ))}
                  </div>
                ) : null
              }
              rows={(filter: string) => {
                const wanted = filter.trim().toLocaleLowerCase();

                return this.languages()
                  .filter((code) => !wanted || languageName(code).toLocaleLowerCase().includes(wanted) || code.toLowerCase().startsWith(wanted))
                  .map((code) => ({
                    key: code,
                    selected: chosen.includes(code),
                    content: (
                      <span className="CanelaContentLanguage-row">
                        <span>{languageName(code)}</span>
                        {chosen.includes(code) && <Icon name="fas fa-check" />}
                      </span>
                    ),
                  }));
              }}
              onselect={(code: string) => this.toggle(code)}
            />
          </div>

          <div className="Form-group CanelaContentLanguage-auto">
            <label className="checkbox">
              <input type="checkbox" checked={this.auto} onchange={(event: Event) => (this.auto = (event.target as HTMLInputElement).checked)} />
              {tr('auto_translate')}
            </label>
          </div>
        </div>
      </div>,
      // O rodapé do d-modal: separado por um traço de ponta a ponta.
      <div className="Modal-footer CanelaContentLanguage-footer">
        <Button className="Button Button--primary" loading={this.saving} onclick={() => this.save()}>
          {tr('save')}
        </Button>
        <Button className="Button Button--flat" onclick={() => this.hide()}>
          {tr('cancel')}
        </Button>
      </div>,
    ];
  }

  save(): void {
    this.saving = true;

    const localeChanged = this.interfaceLocale !== (((app.data as any).locale || 'en') as string);

    saveContentLanguagePreferences(this.understood, this.auto)
      .then(() => {
        // Trocar a interface recarrega a página (o seletor do cabeçalho faz o mesmo).
        if (localeChanged) {
          chooseLocale(this.interfaceLocale);
          return;
        }

        this.hide();
      })
      .catch(() => {
        this.saving = false;
        m.redraw();
      });
  }
}
