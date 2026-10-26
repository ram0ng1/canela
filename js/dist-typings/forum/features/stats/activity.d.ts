import type User from 'flarum/common/models/User';
export interface UserActivity {
    /** Dias distintos com ao menos uma visita. */
    daysVisited: number | null;
    /** Tempo de leitura, em segundos. */
    timeRead: number | null;
    /** Tempo de leitura dos últimos 60 dias, em segundos (o "recente"). */
    recentTimeRead: number | null;
    postsRead: number | null;
    /** Tópicos distintos que a pessoa abriu. */
    topicsViewed: number | null;
    likesGiven: number | null;
    likesReceived: number | null;
}
/** Os nomes dos atributos na API — documentados aqui para o perfil e outras áreas. */
export declare const ACTIVITY_ATTRIBUTES: Record<keyof UserActivity, string>;
/** null quando o perfil ainda não chegou com as estatísticas (ou o recurso está desligado). */
export declare function userActivity(user: User): UserActivity | null;
/**
 * O tempo de leitura por extenso curto: "45 s", "12 min", "3 h", "2 d".
 * Uma unidade só, arredondada — o resumo é para ter ideia, não para auditoria.
 */
export declare function formatReadTime(seconds: number): string;
