/*
 * A lista de uma caixa de mensagens (Últimos, Enviadas, Novo, Não lidos,
 * Arquivo): as conversas do flarum/messages pela API dele, com o filtro
 * `canelaBox` do tema.
 *
 * Um estado próprio, e não o `app.dialogs` do flarum/messages: aquele é o da
 * página /messages e do menu do usuário, sem filtro de caixa, e trocar os
 * parâmetros dele mudaria o que o menu mostra.
 */
import app from 'flarum/forum/app';
import PaginatedListState, { type PaginatedListRequestParams } from 'flarum/common/states/PaginatedListState';
import type Model from 'flarum/common/Model';

import { boxesOn, type Box, type Dialog } from './util';

export interface BoxListParams {
  box: Box;
  sort?: string;
}

export default class BoxListState extends PaginatedListState<Model, BoxListParams> {
  constructor(params: BoxListParams) {
    super(params, 1, 30);
  }

  get type(): string {
    return 'dialogs';
  }

  protected requestParams(): PaginatedListRequestParams {
    const filter: Record<string, unknown> = {};
    const box = this.params.box;

    // Sem o backend do tema, só a caixa que o flarum/messages sabe filtrar.
    if (boxesOn()) filter.canelaBox = box;
    else if (box === 'unread') filter.unread = true;

    return {
      include: ['lastMessage.user', 'users.groups', 'lastMessageUser'],
      filter,
      sort: this.params.sort || '-lastMessageAt',
    };
  }

  dialogs(): Dialog[] {
    return this.getAllItems() as unknown as Dialog[];
  }

  /** Tira a conversa da lista (arquivada, movida para a caixa ou deixada). */
  drop(dialog: Dialog): void {
    this.remove(dialog);
    m.redraw();
  }

  /** O total da API (`meta.page.total`), quando ela manda. */
  total(): number | null {
    return this.totalItems;
  }

  static forBox(box: Box): BoxListState {
    return new BoxListState({ box });
  }
}

/** Atualiza as contagens das abas depois de ler, arquivar ou sair. */
export function refreshCounts(): void {
  const user = app.session.user;

  if (!user) return;

  app.store
    .find('users', user.id()!)
    .then(() => m.redraw())
    .catch(() => {});
}
