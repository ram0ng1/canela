/*
 * Os relatórios do "Relatar problema" (`canela-bug-reports`, o
 * BugReportResource do PHP) como objetos simples, para o fórum ("Meus
 * relatórios") e para o painel do admin.
 *
 * O recurso fala JSON:API; as telas trabalham com o relatório achatado (o id
 * numérico, os atributos e quem enviou, quando a API o inclui). As capturas
 * não vêm no documento: saem de /api/canela-bug-reports/{id}/{region|full}.
 */

export const BUG_REPORTS_TYPE = 'canela-bug-reports';

export interface BugReportUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface BugReportData {
  id: number;
  kind: string;
  status: string;
  description: string;
  currentText: string | null;
  suggestedText: string | null;
  url: string;
  title: string;
  note: string | null;
  hasFull: boolean;
  createdAt: string;
  updatedAt: string | null;
  /** Só para a administração (e com `include=user`). */
  user?: BugReportUser | null;
  /** Só para a administração. */
  context?: Record<string, any>;
}

interface ResourceObject {
  type: string;
  id: string;
  attributes?: Record<string, any>;
  relationships?: Record<string, { data?: { type: string; id: string } | null }>;
}

export interface BugReportsDocument {
  data: ResourceObject | ResourceObject[];
  included?: ResourceObject[];
  meta?: { counts?: Record<string, number>; page?: { total?: number; limit?: number; offset?: number } };
}

function flatten(resource: ResourceObject, included: ResourceObject[]): BugReportData {
  const report = { ...(resource.attributes || {}), id: Number(resource.id) } as BugReportData;
  const linkage = resource.relationships?.user?.data;

  if (resource.relationships && 'user' in resource.relationships) {
    const user = linkage ? included.find((item) => item.type === 'users' && item.id === linkage.id) : null;

    report.user = user
      ? {
          id: Number(user.id),
          username: user.attributes?.username,
          displayName: user.attributes?.displayName,
          avatarUrl: user.attributes?.avatarUrl ?? null,
        }
      : null;
  }

  return report;
}

/** Os relatórios de uma lista, na ordem da API. */
export function reportsFrom(document: BugReportsDocument): BugReportData[] {
  const data = Array.isArray(document.data) ? document.data : [document.data];

  return data.map((resource) => flatten(resource, document.included || []));
}

/** O relatório de uma resposta de um só (envio, mudança). */
export function reportFrom(document: BugReportsDocument): BugReportData {
  return reportsFrom(document)[0];
}

/** O corpo JSON:API de um envio ou de uma mudança. */
export function reportBody(attributes: Record<string, unknown>, id?: number) {
  return { data: { type: BUG_REPORTS_TYPE, ...(id !== undefined ? { id: String(id) } : {}), attributes } };
}
