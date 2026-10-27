/*
 * O alto da área do editor quando há modelos para as tags escolhidas: a
 * linha "Modelo: [seletor]" e, com um modelo de formulário escolhido, os
 * campos no lugar da área de texto.
 *
 * O seletor é o mesmo das categorias (SelectKit): os modelos da tag e, por
 * primeiro, "Texto livre" (que some quando um modelo da tag é obrigatório).
 * A caixa dos campos leva a classe `Composer-flexible`: o core dá a ela a
 * altura que daria à área de texto, e ela rola por dentro.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import SelectKit, { type SelectKitRow } from '../../composer/SelectKit';
import { t } from '../../utils/settings';
import type { TemplateField } from '../../../common/templates';
import type { TemplateState } from './model';

export interface TemplatePanelAttrs extends ComponentAttrs {
  state: TemplateState;
  disabled?: boolean;
  /** `null`: texto livre. */
  onselect: (id: number | null) => void;
  oninput: (key: string, value: string) => void;
}

/** Um id de elemento a partir da chave do campo (acentos e espaços viram traço). */
const fieldId = (key: string, index: number) => `CanelaTemplateField-${index}-${key.replace(/[^\p{L}\p{N}]+/gu, '-')}`;

export default class TemplatePanel extends Component<TemplatePanelAttrs> {
  view(): Mithril.Children {
    const { state, disabled } = this.attrs;
    const form = state.template?.kind === 'form' ? state.template : null;

    return (
      <div className={classList('CanelaTemplatePanel', { 'CanelaTemplatePanel--form': !!form })}>
        <div className="CanelaTemplatePanel-picker">
          <Icon name="fas fa-file-lines" className="CanelaTemplatePanel-icon" />
          <span className="CanelaTemplatePanel-label">{t('templates.picker_label')}</span>
          <SelectKit
            className="CanelaTemplatePanel-select"
            label={t('templates.picker_label')}
            disabled={disabled}
            highlightSelected
            header={
              <span className={classList('CanelaTemplatePanel-value', { 'is-placeholder': !state.selected })}>
                {state.selected ? state.selected.name : t('templates.choose')}
              </span>
            }
            rows={(filter: string) => this.rows(filter)}
            onselect={(key: string) => this.attrs.onselect(key === 'free' ? null : Number(key))}
          />
          {state.loading && <LoadingIndicator size="small" display="inline" />}
        </div>
        {form && (
          <div className="CanelaTemplatePanel-fields Composer-flexible">
            <p className="CanelaTemplatePanel-hint">{t('templates.form_hint')}</p>
            {form.fields.map((field, index) => this.field(field, index))}
          </div>
        )}
      </div>
    );
  }

  rows(filter: string): SelectKitRow[] {
    const { state } = this.attrs;
    const needle = filter.trim().toLowerCase();
    const matches = (name: string) => !needle || name.toLowerCase().includes(needle);

    const rows: SelectKitRow[] = state.candidates
      .filter((template) => matches(template.name))
      .map((template) => ({
        key: String(template.id),
        selected: state.selected?.id === template.id,
        title: template.name,
        content: (
          <div className="CanelaTemplateRow">
            <Icon name={template.kind === 'form' ? 'fas fa-list-check' : 'fas fa-align-left'} className="CanelaTemplateRow-icon" />
            <span className="CanelaTemplateRow-name">{template.name}</span>
            <span className="CanelaTemplateRow-kind">{t(template.kind === 'form' ? 'templates.kind_form' : 'templates.kind_text')}</span>
          </div>
        ),
      }));

    // Com um modelo obrigatório na tag, não há texto livre.
    const free = t('templates.free_text');

    if (!state.candidates.some((template) => template.required) && matches(free)) {
      rows.unshift({
        key: 'free',
        selected: !state.selected,
        title: free,
        content: (
          <div className="CanelaTemplateRow CanelaTemplateRow--free">
            <Icon name="fas fa-pen" className="CanelaTemplateRow-icon" />
            <span className="CanelaTemplateRow-name">{free}</span>
          </div>
        ),
      });
    }

    return rows;
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
