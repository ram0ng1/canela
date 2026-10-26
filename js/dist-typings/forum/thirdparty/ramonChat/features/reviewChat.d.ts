import type Mithril from 'mithril';
import type { ChatReport } from './reviewData';
export interface ChatReportContext {
    busy: Set<string>;
    onResolved: (report: ChatReport) => void;
}
/** O item da fila de uma mensagem do chat denunciada. */
export declare function chatReportItem(report: ChatReport, ctx: ChatReportContext): Mithril.Children;
