import { type Dialog } from './util';
/**
 * "Arquivar" / "Mover para caixa de entrada" (`toggleArchive`):
 * arquivar leva de volta para a caixa de entrada — a mensagem
 * saiu dela —, e mover para a caixa fica na mesma página.
 */
export declare function toggleArchive(dialog: Dialog): Promise<void>;
/**
 * Sair da mensagem: o ✕ ao lado do próprio nome no mapa de participantes
 * ("Tem certeza de que quer sair desta mensagem?").
 */
export declare function leaveDialog(dialog: Dialog): Promise<void>;
