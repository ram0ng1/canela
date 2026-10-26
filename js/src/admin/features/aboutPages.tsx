/*
 * A lista de páginas do fof/pages que viram abas extras da área Sobre
 * (setting `canela.about_pages`, JSON `[{id, label, icon}]` na ordem das
 * abas). O servidor limpa o JSON ao salvar (ids inteiros, até 20) e só mostra
 * no fórum as páginas que cada pessoa pode ver.
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';

import { AdminComponent, trans, getStr, saveSetting, type LooseAttrs } from '../util';
import type Mithril from 'mithril';

const KEY = 'ramon-canela.admin.settings.community';
const SETTING = 'canela.about_pages';
const MAX = 20;
const SAVE_DELAY_MS = 600;

interface Entry {
  id: number;
  label: string;
  icon: string;
}

interface FofPage {
  id: number;
  title: string;
  slug: string;
}

function readEntries(): Entry[] {
  try {
    const parsed = JSON.parse(getStr(SETTING, '[]'));

    return Array.isArray(parsed)
      ? parsed
          .filter((item) => item && Number(item.id) > 0)
          .map((item) => ({ id: Number(item.id), label: String(item.label || ''), icon: String(item.icon || '') }))
      : [];
  } catch {
    return [];
  }
}

export default class AboutPagesEditor extends AdminComponent {
  pages: FofPage[] | null = null;
  saveTimer: ReturnType<typeof setTimeout> | undefined;

  oninit(vnode: Mithril.Vnode<LooseAttrs, this>) {
    super.oninit(vnode);

    app
      .request<any>({ method: 'GET', url: `${app.forum.attribute('apiUrl')}/pages`, params: { 'page[limit]': 50 } })
      .then((res) => {
        this.pages = (res?.data || []).map((p: any) => ({
          id: Number(p.id),
          title: String(p.attributes?.title || p.id),
          slug: String(p.attributes?.slug || ''),
        }));
      })
      .catch(() => (this.pages = []))
      .finally(() => m.redraw());
  }

  onremove(vnode: Mithril.VnodeDOM<LooseAttrs, this>) {
    super.onremove(vnode);

    // Sair no meio da pausa de digitação não pode perder o rótulo.
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.flush();
    }
  }

  /** Guarda em `app.data` na hora (o campo não "volta" num redesenho) e salva já ou depois da pausa. */
  write(entries: Entry[], debounce = false): void {
    app.data.settings[SETTING] = JSON.stringify(entries);
    clearTimeout(this.saveTimer);

    if (debounce) this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
    else this.flush();
  }

  flush(): void {
    this.saveTimer = undefined;
    saveSetting({ [SETTING]: getStr(SETTING, '[]') });
  }

  view() {
    const entries = readEntries();
    const byId = new Map((this.pages || []).map((page) => [page.id, page]));
    const used = new Set(entries.map((entry) => entry.id));
    const available = (this.pages || []).filter((page) => !used.has(page.id));
    const baseUrl = app.forum.attribute<string>('baseUrl');

    const update = (index: number, patch: Partial<Entry>, debounce = false) =>
      this.write(
        entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
        debounce
      );

    const move = (index: number, delta: number) => {
      const next = entries.slice();
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      this.write(next);
    };

    return (
      <div className="Form-group CanelaAdmin-aboutPages">
        {entries.length > 0 && (
          <ol className="CanelaAdmin-aboutPagesList">
            {entries.map((entry, index) => {
              const page = byId.get(entry.id);
              const title = page?.title || trans(`${KEY}.about_pages_missing`, { id: entry.id });

              return (
                <li key={entry.id} className="CanelaAdmin-aboutPage">
                  <div className="CanelaAdmin-aboutPageHead">
                    <span className="CanelaAdmin-aboutPageIcon" aria-hidden="true">
                      <i className={entry.icon || 'far fa-file-lines'} />
                    </span>
                    <strong className="CanelaAdmin-aboutPageTitle">{title}</strong>
                    {page && (
                      <a
                        className="CanelaAdmin-aboutPageView"
                        href={`${baseUrl}/about/${page.slug ? `${page.id}-${page.slug}` : page.id}`}
                        target="_blank"
                        rel="noopener"
                        title={trans(`${KEY}.view_page`)}
                      >
                        <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
                      </a>
                    )}
                    <span className="CanelaAdmin-aboutPageActions">
                      <Button
                        className="Button Button--icon Button--link"
                        icon="fas fa-arrow-up"
                        disabled={index === 0}
                        aria-label={trans(`${KEY}.about_pages_up`)}
                        onclick={() => move(index, -1)}
                      />
                      <Button
                        className="Button Button--icon Button--link"
                        icon="fas fa-arrow-down"
                        disabled={index === entries.length - 1}
                        aria-label={trans(`${KEY}.about_pages_down`)}
                        onclick={() => move(index, 1)}
                      />
                      <Button
                        className="Button Button--icon Button--link CanelaAdmin-aboutPageRemove"
                        icon="fas fa-xmark"
                        aria-label={trans(`${KEY}.about_pages_remove`)}
                        onclick={() => this.write(entries.filter((_, i) => i !== index))}
                      />
                    </span>
                  </div>
                  <div className="CanelaAdmin-aboutPageFields">
                    <label>
                      <span>{trans(`${KEY}.about_pages_label`)}</span>
                      <input
                        className="FormControl"
                        type="text"
                        maxlength={60}
                        value={entry.label}
                        placeholder={page?.title || ''}
                        oninput={(e: InputEvent) => update(index, { label: (e.target as HTMLInputElement).value }, true)}
                      />
                    </label>
                    <label>
                      <span>{trans(`${KEY}.about_pages_icon`)}</span>
                      <input
                        className="FormControl"
                        type="text"
                        maxlength={60}
                        value={entry.icon}
                        placeholder="fas fa-book"
                        oninput={(e: InputEvent) => update(index, { icon: (e.target as HTMLInputElement).value }, true)}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {entries.length < MAX && (
          <select
            className="FormControl CanelaAdmin-aboutPagesAdd"
            value=""
            disabled={this.pages === null || available.length === 0}
            onchange={(e: Event) => {
              const id = Number((e.target as HTMLSelectElement).value);
              if (id > 0) this.write([...entries, { id, label: '', icon: '' }]);
            }}
          >
            <option value="">
              {this.pages !== null && available.length === 0 ? trans(`${KEY}.about_pages_none_left`) : trans(`${KEY}.about_pages_add`)}
            </option>
            {available.map((page) => (
              <option value={String(page.id)}>{page.title}</option>
            ))}
          </select>
        )}

        <p className="helpText">{trans(`${KEY}.about_pages_list_help`)}</p>
      </div>
    );
  }
}
