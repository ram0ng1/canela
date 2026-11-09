/*
 * O seletor de tags do painel (o "Me too", a resposta automática do
 * assistente): as tags carregam uma vez por visita ao admin, primárias com as
 * filhas logo abaixo e as secundárias no fim.
 */
import app from 'flarum/admin/app';
import type Mithril from 'mithril';

import { AdminComponent, getStr, saveSetting, trans } from '../util';

interface TagRow {
  id: string;
  name: string;
  color: string;
  depth: number;
}

/** As tags carregam uma vez por visita ao admin; o card redesenha várias. */
let tagRows: TagRow[] | null = null;
let tagsLoading = false;

function loadTags(): void {
  if (tagRows || tagsLoading) return;

  tagsLoading = true;

  app.store
    .find<any[]>('tags', { include: 'parent' })
    .then((tags) => {
      // Primárias em ordem, cada uma seguida das filhas; as secundárias (sem
      // posição) no fim, em ordem alfabética, como na página de tags.
      const all = [...tags];
      const primary = all.filter((tag) => tag.position() !== null && !tag.parent()).sort((a, b) => a.position() - b.position());
      const rows: TagRow[] = [];
      const row = (tag: any, depth: number): TagRow => ({ id: String(tag.id()), name: tag.name(), color: tag.color() || '', depth });

      for (const tag of primary) {
        rows.push(row(tag, 0));
        all
          .filter((child) => child.parent() === tag)
          .sort((a, b) => (a.position() ?? 0) - (b.position() ?? 0))
          .forEach((child) => rows.push(row(child, 1)));
      }

      all
        .filter((tag) => tag.position() === null && !tag.parent())
        .sort((a, b) => a.name().localeCompare(b.name()))
        .forEach((tag) => rows.push(row(tag, 0)));

      tagRows = rows;
    })
    .catch(() => {
      tagRows = [];
    })
    .finally(() => {
      tagsLoading = false;
      m.redraw();
    });
}

/**
 * A lista de tags com caixas de seleção, gravada como ids separados por
 * vírgula em `settingKey`. Os textos vêm de `transKey` (tags_label,
 * tags_help, tags_loading, tags_some, tags_all, tags_clear): quem usa decide
 * o que "nenhuma marcada" quer dizer.
 */
export default class AdminTagPicker extends AdminComponent {
  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);
    loadTags();
  }

  view() {
    const { settingKey, transKey } = this.attrs;
    const selected = new Set(
      getStr(settingKey)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    );

    const save = (next: Set<string>) => {
      const value = [...next].join(',');
      app.data.settings[settingKey] = value;
      saveSetting({ [settingKey]: value });
    };

    return (
      <div className="Form-group CanelaAdmin-tagPicker">
        <label>{trans(`${transKey}.tags_label`)}</label>
        <p className="helpText">{trans(`${transKey}.tags_help`)}</p>

        {!tagRows ? (
          <p className="helpText">{trans(`${transKey}.tags_loading`)}</p>
        ) : (
          <>
            <p className="CanelaAdmin-tagPicker-summary">
              {selected.size ? trans(`${transKey}.tags_some`, { count: selected.size }) : trans(`${transKey}.tags_all`)}
              {selected.size > 0 && (
                <button type="button" className="Button Button--link" onclick={() => save(new Set())}>
                  {trans(`${transKey}.tags_clear`)}
                </button>
              )}
            </p>
            <ul className="CanelaAdmin-tagPicker-list">
              {tagRows.map((tag) => (
                <li key={tag.id} className={tag.depth ? 'is-child' : ''}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={selected.has(tag.id)}
                      onchange={(event: Event) => {
                        const next = new Set(selected);
                        (event.target as HTMLInputElement).checked ? next.add(tag.id) : next.delete(tag.id);
                        save(next);
                      }}
                    />
                    <span className="CanelaAdmin-tagPicker-swatch" style={{ background: tag.color || 'var(--control-bg)' }} />
                    {tag.name}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }
}
