/*
 * As tags do fórum para os seletores do painel (a tag dos eventos, as do
 * sumário automático, as dos modelos do editor): carregadas uma vez, na
 * ordem do flarum/tags (posição, depois o nome). Sem o flarum/tags, a lista
 * fica vazia.
 */
import app from 'flarum/admin/app';

export interface AdminTag {
  id(): string | undefined;
  name(): string;
  position(): number | null;
  isChild(): boolean;
}

let loading = false;

export function allTags(): AdminTag[] {
  const tags = app.store.all<any>('tags') as AdminTag[];

  if (!tags.length && !loading && 'flarum-tags' in flarum.extensions) {
    loading = true;
    app.store
      .find('tags' as any)
      .then(() => m.redraw())
      .catch(() => {});
  }

  return [...tags].sort((a, b) => {
    const pa = a.position() ?? 9999;
    const pb = b.position() ?? 9999;

    return pa - pb || a.name().localeCompare(b.name());
  });
}
