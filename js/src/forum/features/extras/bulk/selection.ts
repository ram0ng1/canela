/*
 * O estado da seleção em massa: o modo ligado e os ids marcados.
 *
 * Um objeto só para o fórum inteiro (e não estado da página) porque quem
 * desenha a caixa é cada DiscussionListItem, quem desenha a barra é o
 * IndexPage, e os dois precisam ver a mesma seleção. Mudar de página da lista
 * (outra tag, outra ordenação) zera tudo — ver `reset`.
 */
import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';

import { forumBool } from '../../../utils/settings';

class BulkSelection {
  active = false;
  /** Sobe a cada mudança: é o que os itens da lista (SubtreeRetainer) observam. */
  version = 0;
  private ids = new Set<string>();
  /** Último item clicado, para o shift+clique selecionar o intervalo. */
  private anchor: string | null = null;

  has(discussion: Discussion): boolean {
    return this.ids.has(String(discussion.id()));
  }

  count(): number {
    return this.ids.size;
  }

  setActive(active: boolean): void {
    this.active = active;
    this.clear();
  }

  toggle(discussion: Discussion, range = false): void {
    const id = String(discussion.id());

    if (range && this.anchor && this.anchor !== id) {
      const visible = loadedDiscussions().map((item) => String(item.id()));
      const from = visible.indexOf(this.anchor);
      const to = visible.indexOf(id);

      if (from !== -1 && to !== -1) {
        // O intervalo segue o estado do item âncora, como num gerenciador de arquivos.
        const select = this.ids.has(this.anchor);

        visible.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((itemId) => (select ? this.ids.add(itemId) : this.ids.delete(itemId)));
        this.anchor = id;
        this.version++;
        return;
      }
    }

    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);

    this.anchor = id;
    this.version++;
  }

  selectAll(): void {
    loadedDiscussions().forEach((discussion) => this.ids.add(String(discussion.id())));
    this.version++;
  }

  clear(): void {
    this.ids.clear();
    this.anchor = null;
    this.version++;
  }

  /** Os tópicos marcados que ainda estão no store (um excluído some daqui). */
  selected(): Discussion[] {
    return [...this.ids].map((id) => app.store.getById<Discussion>('discussions', id)).filter((discussion): discussion is Discussion => !!discussion);
  }

  forget(discussion: Discussion): void {
    this.ids.delete(String(discussion.id()));
    this.version++;
  }
}

export const selection = new BulkSelection();

/** Os tópicos já carregados na lista, na ordem em que aparecem. */
export function loadedDiscussions(): Discussion[] {
  return app.discussions.getPages().flatMap((page) => page.items);
}

/** Quem modera algo nesta lista — a equipe ("staff"). */
export function canModerate(discussion: Discussion): boolean {
  const model = discussion as Discussion & Record<string, any>;

  return !!(model.canSticky?.() || model.canLock?.() || discussion.canDelete() || (discussion.canHide() && discussion.user() !== app.session.user));
}

export function bulkAvailable(): boolean {
  if (!app.session.user || !forumBool('canelaBulkSelectEnabled', true)) return false;

  return !!app.session.user.isAdmin?.() || loadedDiscussions().some(canModerate);
}
