/*
 * O painel dos modelos no card "Modelos do editor": a lista (nome, tipo, onde
 * vale, obrigatório) e, ao abrir um deles ou "Novo modelo", o editor: nome,
 * tipo, categorias/etiquetas, "sem texto livre", ordem, o texto e, no
 * formulário, a configuração de cada {{campo}} achado no texto.
 *
 * Fala com /api/canela-templates (TemplateResource); só a administração
 * grava. Os campos seguem o texto: ao digitar, a lista é refeita a partir
 * dos {{campos}} (syncFields), mantendo o que já foi configurado.
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { AdminComponent, trans } from '../../util';
import { AdminSwitch } from '../../components/AdminSwitch';
import { allTags } from '../../components/tags';
import {
  FIELD_TYPES,
  TEMPLATES_TYPE,
  syncFields,
  templatesFrom,
  type FieldType,
  type TemplateData,
  type TemplateField,
  type TemplateKind,
  type TemplatesDocument,
} from '../../../common/templates';

export const KEY = 'ramon-canela.admin.settings.templates';

const KINDS: TemplateKind[] = ['text', 'form'];

const apiUrl = (path: string) => `${((app.forum.attribute<string>('apiUrl') as string) || '/api').replace(/\/+$/, '')}${path}`;

const tagsOn = () => 'flarum-tags' in flarum.extensions;

/** O modelo em edição (novo ou existente), solto do que está na lista. */
interface Draft {
  id: number | null;
  name: string;
  kind: TemplateKind;
  body: string;
  fields: TemplateField[];
  required: boolean;
  position: number;
  tags: number[];
}

function draftFrom(template: TemplateData): Draft {
  return {
    id: template.id,
    name: template.name,
    kind: template.kind,
    body: template.body,
    fields: syncFields(template.body, template.fields),
    required: template.required,
    position: template.position,
    tags: [...template.tags],
  };
}

/** O erro da API em texto (o `detail` do primeiro erro JSON:API), se houver. */
function errorDetail(error: any): string | null {
  const detail = error?.response?.errors?.[0]?.detail;

  return typeof detail === 'string' && detail ? detail : null;
}

/** O exemplo de campo nos textos de ajuda ("{{Versão}}") e o texto de exemplo da área vazia. */
const example = () => `{{${trans(`${KEY}.example_field`)}}}`;

const bodyExample = () => {
  const version = trans(`${KEY}.example_field`);
  const description = trans(`${KEY}.example_field_2`);

  return `**${version}:** {{${version}}}

**${description}**
{{${description}}}`;
};

const kindIcon = (kind: TemplateKind) => (kind === 'form' ? 'fas fa-list-check' : 'fas fa-align-left');

export default class TemplateManager extends AdminComponent {
  rows: TemplateData[] | null = null;
  error: string | null = null;
  draft: Draft | null = null;
  saving = false;
  saveError: string | null = null;
  busy = new Set<number>();

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    this.reload();
  }

  reload(): void {
    app
      .request<TemplatesDocument>({
        method: 'GET',
        url: apiUrl('/canela-templates'),
        params: { page: { limit: 100 }, ...(tagsOn() ? { include: 'tags' } : {}) },
      })
      .then((document) => {
        // A ordem do seletor: posição, depois o nome.
        this.rows = templatesFrom(document).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
        this.error = null;
      })
      .catch(() => (this.error = trans(`${KEY}.load_failed`)))
      .finally(() => m.redraw());
  }

  view(): Mithril.Children {
    return <div className="CanelaTemplatesAdmin">{this.draft ? this.editor(this.draft) : this.list()}</div>;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // A lista
  // ───────────────────────────────────────────────────────────────────────────

  list(): Mithril.Children {
    const rows = this.rows;

    return (
      <>
        <div className="CanelaTemplatesAdmin-toolbar">
          <span className="CanelaTemplatesAdmin-count">{rows ? trans(`${KEY}.count`, { count: rows.length }) : null}</span>
          <Button
            className="Button Button--primary"
            icon="fas fa-plus"
            onclick={() =>
              this.open({ id: null, name: '', kind: 'text', body: '', fields: [], required: false, position: rows?.length ?? 0, tags: [] })
            }
          >
            {trans(`${KEY}.new`)}
          </Button>
        </div>
        {this.error && <p className="CanelaTemplatesAdmin-error">{this.error}</p>}
        {!rows && !this.error && <LoadingIndicator />}
        {rows && !rows.length && <p className="CanelaTemplatesAdmin-empty">{trans(`${KEY}.empty`)}</p>}
        {rows && rows.length > 0 && <ul className="CanelaTemplatesAdmin-list">{rows.map((template) => this.row(template))}</ul>}
      </>
    );
  }

  row(template: TemplateData): Mithril.Children {
    const tags = allTags();
    const names = template.tags.map((id) => tags.find((tag) => String(tag.id()) === String(id))?.name()).filter(Boolean) as string[];
    const busy = this.busy.has(template.id);

    return (
      <li key={template.id} className="CanelaTemplatesAdmin-item">
        <i className={classList('CanelaTemplatesAdmin-kindIcon', kindIcon(template.kind))} aria-hidden="true" />
        <div className="CanelaTemplatesAdmin-main">
          <span className="CanelaTemplatesAdmin-name">{template.name}</span>
          <span className="CanelaTemplatesAdmin-badges">
            <span className="CanelaTemplatesAdmin-badge">{trans(`${KEY}.kind_${template.kind}`)}</span>
            {template.required && (
              <span className="CanelaTemplatesAdmin-badge CanelaTemplatesAdmin-badge--required">{trans(`${KEY}.badge_required`)}</span>
            )}
            <span className="CanelaTemplatesAdmin-where">{names.length ? names.join(', ') : trans(`${KEY}.tags_all`)}</span>
          </span>
        </div>
        <div className="CanelaTemplatesAdmin-actions">
          <Button className="Button Button--link" icon="fas fa-pen" disabled={busy} onclick={() => this.open(draftFrom(template))}>
            {trans(`${KEY}.edit`)}
          </Button>
          <Button
            className="Button Button--link CanelaTemplatesAdmin-delete"
            icon="fas fa-trash"
            disabled={busy}
            loading={busy}
            onclick={() => this.remove(template)}
          >
            {trans(`${KEY}.delete`)}
          </Button>
        </div>
      </li>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // O editor
  // ───────────────────────────────────────────────────────────────────────────

  open(draft: Draft): void {
    this.draft = draft;
    this.saveError = null;
  }

  close(): void {
    this.draft = null;
    this.saveError = null;
  }

  editor(draft: Draft): Mithril.Children {
    const tags = tagsOn() ? allTags() : [];
    const canSave = !this.saving && !!draft.name.trim() && !!draft.body.trim();

    return (
      <div className="CanelaTemplatesAdmin-editor">
        <h4 className="CanelaTemplatesAdmin-editorTitle">
          {draft.id === null ? trans(`${KEY}.new`) : trans(`${KEY}.editing`, { name: draft.name })}
        </h4>

        <div className="Form-group">
          <label className="CanelaAdmin-label" for="CanelaTemplate-name">
            {trans(`${KEY}.name_label`)}
          </label>
          <input
            id="CanelaTemplate-name"
            className="FormControl"
            value={draft.name}
            maxlength={100}
            placeholder={trans(`${KEY}.name_placeholder`)}
            oninput={(event: Event) => (draft.name = (event.target as HTMLInputElement).value)}
          />
        </div>

        <div className="Form-group">
          <span className="CanelaAdmin-label">{trans(`${KEY}.kind_label`)}</span>
          <div className="CanelaTemplatesAdmin-kinds" role="radiogroup">
            {KINDS.map((kind) => (
              <label className={classList('CanelaTemplatesAdmin-kind', { 'is-on': draft.kind === kind })}>
                <input type="radio" name="CanelaTemplate-kind" value={kind} checked={draft.kind === kind} onchange={() => (draft.kind = kind)} />
                <span className="CanelaTemplatesAdmin-kindName">
                  <i className={kindIcon(kind)} aria-hidden="true" /> {trans(`${KEY}.kind_${kind}`)}
                </span>
                <span className="CanelaTemplatesAdmin-kindHelp">{trans(`${KEY}.kind_${kind}_help`)}</span>
              </label>
            ))}
          </div>
        </div>

        {tagsOn() ? (
          <div className="Form-group">
            <span className="CanelaAdmin-label">{trans(`${KEY}.tags_label`)}</span>
            <div className="CanelaAdmin-chips">
              {tags.map((tag) => {
                const id = Number(tag.id());
                const on = draft.tags.includes(id);

                return (
                  <label className={classList('CanelaAdmin-chip', { 'is-on': on })}>
                    <input
                      type="checkbox"
                      checked={on}
                      onchange={() => (draft.tags = on ? draft.tags.filter((other) => other !== id) : [...draft.tags, id])}
                    />{' '}
                    {tag.isChild() ? `— ${tag.name()}` : tag.name()}
                  </label>
                );
              })}
            </div>
            <p className="helpText">{trans(`${KEY}.tags_help`)}</p>
          </div>
        ) : (
          <p className="helpText">{trans(`${KEY}.tags_missing`)}</p>
        )}

        <div className="Form-group CanelaAdmin-toggle">
          <div className="CanelaAdmin-toggleRow">
            <label className="CanelaAdmin-toggleLabel" for="CanelaTemplate-required">
              {trans(`${KEY}.required_label`)}
            </label>
            <AdminSwitch
              id="CanelaTemplate-required"
              state={draft.required}
              describedBy="CanelaTemplate-required-help"
              onchange={(checked: boolean) => (draft.required = checked)}
            />
          </div>
          <p className="helpText" id="CanelaTemplate-required-help">
            {trans(`${KEY}.required_help`)}
          </p>
        </div>

        <div className="Form-group">
          <label className="CanelaAdmin-label" for="CanelaTemplate-position">
            {trans(`${KEY}.position_label`)}
          </label>
          <input
            id="CanelaTemplate-position"
            type="number"
            className="FormControl CanelaTemplatesAdmin-position"
            min={0}
            max={9999}
            value={draft.position}
            oninput={(event: Event) => (draft.position = Math.max(0, parseInt((event.target as HTMLInputElement).value, 10) || 0))}
          />
          <p className="helpText">{trans(`${KEY}.position_help`)}</p>
        </div>

        <div className="Form-group">
          <label className="CanelaAdmin-label" for="CanelaTemplate-body">
            {trans(`${KEY}.body_label`)}
          </label>
          <textarea
            id="CanelaTemplate-body"
            className="FormControl CanelaTemplatesAdmin-body"
            rows={10}
            value={draft.body}
            placeholder={bodyExample()}
            oninput={(event: Event) => {
              draft.body = (event.target as HTMLTextAreaElement).value;
              draft.fields = syncFields(draft.body, draft.fields);
            }}
          />
          <p className="helpText">{trans(`${KEY}.body_help`, { example: example() })}</p>
        </div>

        {draft.kind === 'form' && this.fieldsEditor(draft)}

        {this.saveError && (
          <p className="CanelaTemplatesAdmin-error" role="alert">
            {this.saveError}
          </p>
        )}

        <div className="CanelaTemplatesAdmin-buttons">
          <Button className="Button Button--primary" loading={this.saving} disabled={!canSave} onclick={() => this.save(draft)}>
            {trans(`${KEY}.save`)}
          </Button>
          <Button className="Button" disabled={this.saving} onclick={() => this.close()}>
            {trans(`${KEY}.cancel`)}
          </Button>
        </div>
      </div>
    );
  }

  fieldsEditor(draft: Draft): Mithril.Children {
    return (
      <div className="CanelaTemplatesAdmin-fields">
        <h5 className="CanelaTemplatesAdmin-fieldsTitle">{trans(`${KEY}.fields_heading`)}</h5>
        <p className="helpText">{trans(`${KEY}.fields_help`)}</p>
        {!draft.fields.length && <p className="CanelaTemplatesAdmin-empty">{trans(`${KEY}.fields_empty`, { example: example() })}</p>}
        {draft.fields.map((field, index) => this.fieldEditor(field, index))}
      </div>
    );
  }

  fieldEditor(field: TemplateField, index: number): Mithril.Children {
    const id = `CanelaTemplateField-${index}`;

    const text = (prop: 'label' | 'placeholder' | 'description') => (
      <div className="Form-group">
        <label className="CanelaAdmin-label" for={`${id}-${prop}`}>
          {trans(`${KEY}.field_${prop}`)}
        </label>
        <input
          id={`${id}-${prop}`}
          className="FormControl"
          value={field[prop]}
          maxlength={prop === 'label' ? 100 : 500}
          oninput={(event: Event) => (field[prop] = (event.target as HTMLInputElement).value)}
        />
      </div>
    );

    return (
      <div key={field.key} className="CanelaTemplatesAdmin-field">
        <div className="CanelaTemplatesAdmin-fieldKey">
          <code>{`{{${field.key}}}`}</code>
        </div>
        <div className="CanelaTemplatesAdmin-fieldGrid">
          {text('label')}
          <div className="Form-group">
            <label className="CanelaAdmin-label" for={`${id}-type`}>
              {trans(`${KEY}.field_type`)}
            </label>
            <div className="CanelaAdmin-select-wrap">
              <select
                id={`${id}-type`}
                className="FormControl CanelaAdmin-select"
                value={field.type}
                onchange={(event: Event) => (field.type = (event.target as HTMLSelectElement).value as FieldType)}
              >
                {FIELD_TYPES.map((type) => (
                  <option value={type}>{trans(`${KEY}.field_type_${type}`)}</option>
                ))}
              </select>
              <i className="fas fa-chevron-down CanelaAdmin-select-chevron" aria-hidden="true" />
            </div>
          </div>
          {text('placeholder')}
          {text('description')}
          {field.type === 'select' && (
            <div className="Form-group CanelaTemplatesAdmin-fieldWide">
              <label className="CanelaAdmin-label" for={`${id}-options`}>
                {trans(`${KEY}.field_options`)}
              </label>
              <textarea
                id={`${id}-options`}
                className="FormControl"
                rows={4}
                value={field.options.join('\n')}
                oninput={(event: Event) => (field.options = (event.target as HTMLTextAreaElement).value.split('\n'))}
              />
              <p className="helpText">{trans(`${KEY}.field_options_help`)}</p>
            </div>
          )}
          <label className="CanelaTemplatesAdmin-fieldRequired">
            <input
              type="checkbox"
              checked={field.required}
              onchange={(event: Event) => (field.required = (event.target as HTMLInputElement).checked)}
            />{' '}
            {trans(`${KEY}.field_required`)}
          </label>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Gravar e apagar
  // ───────────────────────────────────────────────────────────────────────────

  save(draft: Draft): void {
    this.saving = true;
    this.saveError = null;

    const attributes: Record<string, unknown> = {
      name: draft.name.trim(),
      kind: draft.kind,
      body: draft.body,
      required: draft.required,
      position: draft.position,
      fields:
        draft.kind === 'form'
          ? draft.fields.map((field) => ({ ...field, options: field.options.map((option) => option.trim()).filter(Boolean) }))
          : null,
    };

    const data: Record<string, unknown> = { type: TEMPLATES_TYPE, attributes };

    if (draft.id !== null) data.id = String(draft.id);
    if (tagsOn()) data.relationships = { tags: { data: draft.tags.map((id) => ({ type: 'tags', id: String(id) })) } };

    app
      .request<TemplatesDocument>({
        method: draft.id === null ? 'POST' : 'PATCH',
        url: apiUrl(draft.id === null ? '/canela-templates' : `/canela-templates/${draft.id}`),
        body: { data },
        // Sem o alerta do core: o erro aparece junto do botão.
        errorHandler: (error: any) => {
          this.saveError = errorDetail(error) || trans(`${KEY}.save_failed`);
        },
      })
      .then(() => {
        this.close();
        this.reload();
      })
      .catch(() => {
        this.saveError ||= trans(`${KEY}.save_failed`);
      })
      .finally(() => {
        this.saving = false;
        m.redraw();
      });
  }

  remove(template: TemplateData): void {
    if (!confirm(trans(`${KEY}.delete_confirm`, { name: template.name }))) return;

    this.busy.add(template.id);

    app
      .request({ method: 'DELETE', url: apiUrl(`/canela-templates/${template.id}`) })
      .then(() => {
        this.rows = (this.rows || []).filter((row) => row.id !== template.id);
      })
      .catch(() => {})
      .finally(() => {
        this.busy.delete(template.id);
        m.redraw();
      });
  }
}
