import { warm } from './capture';
import type { BugReportsOptions } from './index';
export { warm };
/** Marcar, capturar e abrir o modal do envio. */
export declare function startReport(opts: BugReportsOptions): Promise<void>;
export declare function showMyReports(): void;
