import type Discussion from 'flarum/common/models/Discussion';
import type DiscussionListState from 'flarum/forum/states/DiscussionListState';
export declare function discussionViews(discussion: Discussion): number | null;
/** A coluna inteira só aparece se ao menos uma discussão da lista trouxer o número. */
export declare function listHasViews(state: DiscussionListState): boolean;
type Heat = 'low' | 'med' | 'high' | null;
/**
 * Faixas das respostas. Medir o calor pela razão curtidas/posts pediria
 * dados que o Flarum não tem sem extensão; o volume de respostas é o sinal mais
 * próximo de "conversa animada" que todo fórum tem.
 */
export declare function repliesHeat(count: number): Heat;
/**
 * As faixas das visualizações vêm do admin (topic_views_heat_low/medium/high,
 * 1000/2000/3500 por padrão) — a regra mora em utils/views, que as
 * mensagens privadas também usam.
 */
export declare function viewsHeat(count: number): Heat;
/**
 * O mapa de frio: quanto mais tempo entre a criação e a última
 * resposta, mais "frio" o tópico — uma conversa antiga ressuscitada aparece
 * em tom diferente de uma que acabou de começar.
 */
export declare function activityCold(discussion: Discussion): Heat;
export {};
