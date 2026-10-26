import PaginatedListState, { type PaginatedListRequestParams } from 'flarum/common/states/PaginatedListState';
import type Model from 'flarum/common/Model';
import { type Box, type Dialog } from './util';
export interface BoxListParams {
    box: Box;
    sort?: string;
}
export default class BoxListState extends PaginatedListState<Model, BoxListParams> {
    constructor(params: BoxListParams);
    get type(): string;
    protected requestParams(): PaginatedListRequestParams;
    dialogs(): Dialog[];
    /** Tira a conversa da lista (arquivada, movida para a caixa ou deixada). */
    drop(dialog: Dialog): void;
    /** O total da API (`meta.page.total`), quando ela manda. */
    total(): number | null;
    static forBox(box: Box): BoxListState;
}
/** Atualiza as contagens das abas depois de ler, arquivar ou sair. */
export declare function refreshCounts(): void;
