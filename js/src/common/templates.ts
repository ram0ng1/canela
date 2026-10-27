/*
 * Os modelos do editor (`canela-templates`, o TemplateResource do PHP) como
 * objetos simples, para o composer do fórum e para o painel do admin.
 *
 * O contrato dos campos é o de src/Templates/TemplateFields.php: o que está
 * entre `{{` e `}}` no texto é um campo, e `fields` descreve cada um (rótulo,
 * tipo, dica, opções, obrigatório). O texto final é o do modelo com cada
 * {{campo}} trocado pelo valor preenchido.
 */

export const TEMPLATES_TYPE = 'canela-templates';

export type TemplateKind = 'text' | 'form';

export type FieldType = 'text' | 'textarea' | 'select';

export const FIELD_TYPES: FieldType[] = ['text', 'textarea', 'select'];

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  placeholder: string;
  description: string;
  required: boolean;
  options: string[];
}

/** Uma entrada do índice que o fórum recebe em toda página (`canelaTemplates`). */
export interface TemplateSummary {
  id: number;
  name: string;
  kind: TemplateKind;
  /** Onde o modelo vale, não há a opção de texto livre. */
  required: boolean;
  /** As tags em que vale; vazio: em qualquer tópico novo. */
  tags: number[];
}

/** O modelo inteiro, como vem da API. */
export interface TemplateData extends TemplateSummary {
  body: string;
  fields: TemplateField[];
  position: number;
}

export interface ResourceObject {
  type: string;
  id: string;
  attributes?: Record<string, any>;
  relationships?: Record<string, { data?: { type: string; id: string }[] | { type: string; id: string } | null }>;
}

export interface TemplatesDocument {
  data: ResourceObject | ResourceObject[];
  included?: ResourceObject[];
}

/** O mesmo padrão do PHP: até 60 caracteres, sem chaves nem quebra de linha. */
const placeholderPattern = () => /\{\{\s*([^{}\r\n]{1,60}?)\s*\}\}/gu;

/** As chaves dos campos, sem repetir, na ordem em que aparecem no texto. */
export function placeholders(body: string): string[] {
  const pattern = placeholderPattern();
  const keys: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    const key = match[1].trim();

    if (key && !keys.includes(key)) keys.push(key);
  }

  return keys;
}

export function defaultField(key: string): TemplateField {
  return { key, label: key, type: 'text', placeholder: '', description: '', required: false, options: [] };
}

/** Os campos do texto atual, mantendo a configuração dos que já existiam. */
export function syncFields(body: string, previous: TemplateField[]): TemplateField[] {
  return placeholders(body).map((key) => previous.find((field) => field.key === key) ?? defaultField(key));
}

/** O texto final: cada {{campo}} trocado pelo valor (vazio quando não preenchido). */
export function render(body: string, values: Record<string, string>): string {
  return body.replace(placeholderPattern(), (_match: string, key: string) => (values[key.trim()] ?? '').trim());
}

/** Os campos obrigatórios ainda em branco. */
export function missingRequired(fields: TemplateField[], values: Record<string, string>): TemplateField[] {
  return fields.filter((field) => field.required && !(values[field.key] ?? '').trim());
}

/** Um campo como vem da API (o PHP já o normalizou; aqui só a forma). */
function fieldFrom(raw: any): TemplateField | null {
  if (!raw || typeof raw !== 'object' || typeof raw.key !== 'string') return null;

  return {
    key: raw.key,
    label: typeof raw.label === 'string' && raw.label ? raw.label : raw.key,
    type: FIELD_TYPES.includes(raw.type) ? raw.type : 'text',
    placeholder: String(raw.placeholder ?? ''),
    description: String(raw.description ?? ''),
    required: !!raw.required,
    options: Array.isArray(raw.options) ? raw.options.map(String) : [],
  };
}

export function templateFrom(resource: ResourceObject): TemplateData {
  const attrs = resource.attributes || {};
  const linkage = resource.relationships?.tags?.data;
  const fields = Array.isArray(attrs.fields) ? (attrs.fields.map(fieldFrom).filter(Boolean) as TemplateField[]) : [];

  return {
    id: Number(resource.id),
    name: String(attrs.name ?? ''),
    kind: attrs.kind === 'form' ? 'form' : 'text',
    required: !!attrs.required,
    tags: Array.isArray(linkage) ? linkage.map((item) => Number(item.id)) : [],
    body: String(attrs.body ?? ''),
    fields,
    position: Number(attrs.position ?? 0) || 0,
  };
}

export function templatesFrom(document: TemplatesDocument): TemplateData[] {
  const data = Array.isArray(document.data) ? document.data : [document.data];

  return data.map(templateFrom);
}
