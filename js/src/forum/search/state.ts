/*
 * O estado da busca, compartilhado entre os menus (o do cabeçalho e o do
 * banner de boas-vindas): o termo, se a
 * busca já inclui os tópicos (depois do Enter) e os resultados.
 *
 * Digitar faz só a busca "rápida":
 * categorias, etiquetas e usuários, com 400ms de espera. Os tópicos entram
 * quando a pessoa pressiona Enter ou escolhe uma sugestão.
 *
 * Aqui fica só o que o campo desenha; a busca em si (engine.ts) desce com o
 * painel (SearchPanel), pedido no foco/hover do campo ou no ocioso do boot.
 */
import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';

import type { CanelaTag } from '../utils/tags';
import { withSearchPanel } from './panelLazy';

export interface SearchResults {
  /** O texto livre (sem gambits), para destacar nos títulos e trechos. */
  text: string;
  topics: Discussion[];
  moreTopics: boolean;
  categories: CanelaTag[];
  tags: CanelaTag[];
  users: User[];
}

export class SearchMenuState {
  term = '';
  /** A busca já inclui os tópicos. */
  searchTopics = false;
  loading = false;
  invalidTerm = false;
  noResults = false;
  results: SearchResults | null = null;
  /** "#", "@" ou o atalho digitado ("é:"): o assistente aparece no lugar dos resultados. */
  suggestionKeyword: string | false = false;
  suggestionResults: Array<CanelaTag | User> = [];

  /** Troca o termo da busca. */
  setTerm(term: string, opts: { searchTopics?: boolean } = {}): void {
    this.term = term.replace(/[​-‍﻿]/g, '');
    this.searchTopics = !!opts.searchTopics;
    this.trigger();
  }

  /** Enter: a mesma consulta, agora com os tópicos. */
  searchTopicsNow(): void {
    this.searchTopics = true;
    this.trigger();
  }

  clear(): void {
    this.setTerm('');
  }

  trigger(): void {
    this.noResults = false;
    // O carregando do Enter aparece já; o resto vem do motor (síncrono quando o chunk já chegou).
    this.loading = this.searchTopics;
    withSearchPanel((panel) => panel.trigger(this));
  }
}

const state = new SearchMenuState();

export default state;
