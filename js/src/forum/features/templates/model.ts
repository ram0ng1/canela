/*
 * O estado dos modelos no composer e o acesso a eles: o índice que o servidor
 * manda em toda página (`canelaTemplates`: id, nome, tipo, tags), os modelos
 * que valem para as tags escolhidas e o modelo inteiro (texto e campos), que
 * desce pela API quando é escolhido e fica guardado até sair da página.
 */
import app from 'flarum/forum/app';

import { forumBool } from '../../utils/settings';
import { templateFrom, type ResourceObject, type TemplateData, type TemplateSummary, type TemplatesDocument } from '../../../common/templates';

export interface TemplateState {
  /** As tags da última vez (ids em ordem), para perceber a troca; nulo antes da primeira. */
  tagKey: string | null;
  /** Os modelos que valem para as tags de agora. */
  candidates: TemplateSummary[];
  selected: TemplateSummary | null;
  /** O modelo escolhido inteiro, quando já desceu. */
  template: TemplateData | null;
  loading: boolean;
  /** Conta os pedidos: a resposta de um modelo trocado no meio do caminho é ignorada. */
  request: number;
  /** O que foi preenchido em cada campo do formulário. */
  values: Record<string, string>;
  /**
   * O último texto que o recurso pôs no composer. Enquanto o conteúdo for
   * esse, ele é do recurso: pode ser trocado por outro modelo sem perguntar.
   */
  applied: string | null;
  /** O texto que a pessoa tinha antes do formulário; volta ao sair dele. */
  backup: string | null;
  /** Os campos obrigatórios em branco apontados no último envio. */
  invalid: Set<string>;
}

export function newState(): TemplateState {
  return {
    tagKey: null,
    candidates: [],
    selected: null,
    template: null,
    loading: false,
    request: 0,
    values: {},
    applied: null,
    backup: null,
    invalid: new Set(),
  };
}

export function templatesOn(): boolean {
  return forumBool('canelaTemplatesEnabled', true);
}

export function templatesIndex(): TemplateSummary[] {
  const value = app.forum?.attribute<unknown>('canelaTemplates');

  return Array.isArray(value) ? (value as TemplateSummary[]) : [];
}

/** Os modelos que valem para as tags escolhidas: os sem tag e os de alguma delas. */
export function candidatesFor(tagIds: string[]): TemplateSummary[] {
  if (!templatesOn()) return [];

  const chosen = new Set(tagIds.map(Number));

  return templatesIndex().filter((template) => template.tags.length === 0 || template.tags.some((id) => chosen.has(id)));
}

const cache = new Map<number, Promise<TemplateData>>();

/** O modelo inteiro, pedido uma vez por página. */
export function loadTemplate(id: number): Promise<TemplateData> {
  let pending = cache.get(id);

  if (!pending) {
    const apiUrl = ((app.forum.attribute<string>('apiUrl') as string) || '/api').replace(/\/+$/, '');

    pending = app
      .request<TemplatesDocument>({ method: 'GET', url: `${apiUrl}/canela-templates/${id}` })
      .then((document) => templateFrom(document.data as ResourceObject));

    // Falhou: o próximo pedido tenta de novo.
    pending.catch(() => cache.delete(id));
    cache.set(id, pending);
  }

  return pending;
}
