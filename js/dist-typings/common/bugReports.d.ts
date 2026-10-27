export declare const BUG_REPORTS_TYPE = "canela-bug-reports";
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
    relationships?: Record<string, {
        data?: {
            type: string;
            id: string;
        } | null;
    }>;
}
export interface BugReportsDocument {
    data: ResourceObject | ResourceObject[];
    included?: ResourceObject[];
    meta?: {
        counts?: Record<string, number>;
        page?: {
            total?: number;
            limit?: number;
            offset?: number;
        };
    };
}
/** Os relatórios de uma lista, na ordem da API. */
export declare function reportsFrom(document: BugReportsDocument): BugReportData[];
/** O relatório de uma resposta de um só (envio, mudança). */
export declare function reportFrom(document: BugReportsDocument): BugReportData;
/** O corpo JSON:API de um envio ou de uma mudança. */
export declare function reportBody(attributes: Record<string, unknown>, id?: number): {
    data: {
        attributes: Record<string, unknown>;
        id?: string | undefined;
        type: string;
    };
};
export {};
