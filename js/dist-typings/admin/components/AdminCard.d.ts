import type { CardDef } from '../types';
/** Por que o card está trancado, ou `null`. */
export declare const lockReason: (card: CardDef) => {
    text: string;
    extension?: string;
} | null;
export declare const AdminCard: any;
/** Aviso em destaque dentro de um card: dependências, efeitos colaterais. */
export declare const AdminNotice: any;
export declare const SubDivider: any;
/** Opções que dependem da de cima, recuadas num bloco. */
export declare const AdminSubGroup: any;
/** Um título pequeno que separa blocos dentro de um card. */
export declare const SubTitle: any;
