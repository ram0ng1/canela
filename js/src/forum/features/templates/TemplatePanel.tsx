/*
 * Os campos de um modelo "sem texto livre", no lugar da área de texto do
 * composer: um por {{campo}} do texto, com rótulo, dica e ajuda. A caixa
 * leva a classe `Composer-flexible`: o core dá a ela a altura que daria à
 * área de texto, e ela rola por dentro.
 *
 * Trocar de modelo (ou voltar ao texto livre, quando a tag permite) é pelo
 * menu ⊕ da barra do editor (ver index.tsx): nada a mais no corpo do composer.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import type { TemplateData, TemplateField } from '../../../common/templates';
import type { TemplateState } from './model';

export interface TemplatePanelAttrs extends ComponentAttrs {
  state: TemplateState;
  template: TemplateData;
  disabled?: boolean;
  oninput: (key: string, value: string) => void;
}

/** Um id de elemento a partir da chave do campo (acentos e espaços viram traço). */
const fieldId = (key: string, index: number) => `CanelaTemplateField-${index}-${key.replace(/[^\p{L}\p{N}]+/gu, '-')}`;

export default class TemplatePanel extends Component<TemplatePanelAttrs> {
  view(): Mithril.Children {
    const { template } = this.attrs;

    return (
      <div className="CanelaTemplatePanel Composer-flexible">
        <p className="CanelaTemplatePanel-hint">{t('templates.form_hint', { name: template.name })}</p>
        {template.fields.map((field, index) => this.field(field, index))}
      </div>
    );
  }

  field(field: TemplateField, index: number): Mithril.Children {
    const { state, disabled } = this.attrs;
    const id = fieldId(field.key, index);
    const value = state.values[field.key] ?? '';
    const invalid = state.invalid.has(field.key);
    const update = (event: Event) =>
      this.attrs.oninput(field.key, (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value);

    const common = {
      id,
      className: 'FormControl',
      value,
      disabled,
      'aria-required': field.required ? 'true' : undefined,
      'aria-invalid': invalid ? 'true' : undefined,
      'aria-describedby': field.description ? `${id}-help` : undefined,
    };

    let control: Mithril.Children;

    if (field.type === 'select') {
      control = (
        <select {...common} onchange={update}>
          <option value="">{field.placeholder || t('templates.select_placeholder')}</option>
          {field.options.map((option) => (
            <option value={option}>{option}</option>
          ))}
        </select>
      );
    } else if (field.type === 'textarea') {
      control = <textarea {...common} rows={4} placeholder={field.placeholder || undefined} oninput={update} />;
    } else {
      control = <input type="text" {...common} placeholder={field.placeholder || undefined} oninput={update} />;
    }

    return (
      <div
        key={field.key}
        className={classList('CanelaTemplateField', { 'is-required': field.required, 'is-invalid': invalid })}
        data-key={field.key}
      >
        <label className="CanelaTemplateField-label" for={id}>
          {field.label}
          {field.required && (
            <span className="CanelaTemplateField-required" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {control}
        {field.description && (
          <p className="CanelaTemplateField-help helpText" id={`${id}-help`}>
            {field.description}
          </p>
        )}
      </div>
    );
  }
}
