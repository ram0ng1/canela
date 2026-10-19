/*
 * Rolagem infinita da lista, como o Discourse: a próxima página carrega
 * sozinha quando o fim da lista chega perto da tela. O botão "Carregar mais"
 * do core continua lá — é o que aparece sem IntersectionObserver e o que o
 * teclado alcança.
 */
import { extend } from 'flarum/common/extend';
import DiscussionList from 'flarum/forum/components/DiscussionList';
import type DiscussionListState from 'flarum/forum/states/DiscussionListState';

import { forumBool } from '../utils/settings';

interface Watched {
  canelaObserver?: IntersectionObserver;
  canelaTarget?: Element | null;
  /** Páginas e carregamento na última conferência (onupdate). */
  canelaChecked?: string;
}

function stateOf(list: DiscussionList): DiscussionListState | undefined {
  return (list as any).attrs?.state;
}

/**
 * Só a lista que o leitor está vendo: a cópia no painel lateral da página
 * de discussão (`.DiscussionPage-list`) ou uma lista escondida não carrega
 * páginas sozinha.
 */
function visible(list: DiscussionList): boolean {
  const element = list.element as HTMLElement | undefined;

  if (!element || element.closest('.DiscussionPage-list')) return false;

  const rect = element.getBoundingClientRect();

  return rect.width > 0 && rect.height > 0 && element.offsetParent !== null;
}

function maybeLoad(list: DiscussionList): void {
  const state = stateOf(list);

  if (!visible(list)) return;

  if (!state || !state.hasNext() || state.isInitialLoading() || state.isLoadingNext()) return;

  state.loadNext();
}

/**
 * Observa o `.DiscussionList-loadMore` atual. O elemento muda quando a lista
 * fica vazia e volta (o core troca a árvore pelo Placeholder), então a cada
 * redesenho confere se ainda é o mesmo.
 */
function watch(list: DiscussionList & Watched): void {
  if (typeof IntersectionObserver === 'undefined' || !forumBool('canelaListInfiniteScroll', true)) return;

  const target = list.element?.querySelector('.DiscussionList-loadMore') ?? null;

  if (target === list.canelaTarget) return;

  list.canelaObserver?.disconnect();
  list.canelaTarget = target;

  if (!target) return;

  // 600px de folga: a página seguinte chega antes de o leitor ver o fim.
  list.canelaObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) maybeLoad(list);
    },
    { rootMargin: '0px 0px 600px 0px' }
  );

  list.canelaObserver.observe(target);
}

export default function installInfiniteScroll(): void {
  extend(DiscussionList.prototype, 'oncreate', function (this: DiscussionList & Watched) {
    watch(this);
  });

  extend(DiscussionList.prototype, 'onupdate', function (this: DiscussionList & Watched) {
    watch(this);

    // Uma página curta pode terminar de carregar com o fim ainda visível: o
    // observador não dispara de novo sem mudança de interseção, então confere.
    // Só quando uma página chega (ou o carregamento termina): medir a posição
    // força o layout, e a lista redesenha à toa a cada interação.
    const target = this.canelaTarget;
    const state = stateOf(this);
    const signature = state ? `${state.getPages().length}:${state.isLoadingNext() ? 1 : 0}:${state.isInitialLoading() ? 1 : 0}` : '';

    if (signature === this.canelaChecked) return;

    this.canelaChecked = signature;

    if (target && forumBool('canelaListInfiniteScroll', true)) {
      const rect = target.getBoundingClientRect();

      if (rect.top < window.innerHeight + 600) maybeLoad(this);
    }
  });

  extend(DiscussionList.prototype, 'onremove', function (this: DiscussionList & Watched) {
    this.canelaObserver?.disconnect();
    this.canelaObserver = undefined;
    this.canelaTarget = null;
  });
}
