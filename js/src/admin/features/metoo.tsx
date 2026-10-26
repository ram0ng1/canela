/*
 * Card do "Me too" no grupo "Tópico": o liga/desliga, em quais categorias e
 * etiquetas o botão aparece (o padrão
 * é todas), se some com a melhor resposta e se quem marca passa a
 * seguir o tópico. As chaves são `canela.metoo_*`, de extend/metoo.php.
 */
import app from 'flarum/admin/app';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';
import type Mithril from 'mithril';

import { AdminNotice } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import { AdminComponent, getStr, saveSetting, trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.metoo';
const TAGS_SETTING = 'canela.metoo_tags';

const toggle = (name: string, extension?: string) => (
  <AdminToggle settingKey={`canela.metoo_${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} extension={extension} />
);

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
 * A lista de tags com caixas de seleção. Nenhuma marcada = todas: assim um
 * fórum novo ganha o botão em todo tópico, e quem quer o botão só em
 * algumas (Suporte, Bug…) marca as dele.
 */
class AdminTagPicker extends AdminComponent {
  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);
    loadTags();
  }

  view() {
    const selected = new Set(
      getStr(TAGS_SETTING)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    );

    const save = (next: Set<string>) => {
      const value = [...next].join(',');
      app.data.settings[TAGS_SETTING] = value;
      saveSetting({ [TAGS_SETTING]: value });
    };

    return (
      <div className="Form-group CanelaAdmin-tagPicker">
        <label>{trans(`${KEY}.tags_label`)}</label>
        <p className="helpText">{trans(`${KEY}.tags_help`)}</p>

        {!tagRows ? (
          <p className="helpText">{trans(`${KEY}.tags_loading`)}</p>
        ) : (
          <>
            <p className="CanelaAdmin-tagPicker-summary">
              {selected.size ? trans(`${KEY}.tags_some`, { count: selected.size }) : trans(`${KEY}.tags_all`)}
              {selected.size > 0 && (
                <button type="button" className="Button Button--link" onclick={() => save(new Set())}>
                  {trans(`${KEY}.tags_clear`)}
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

const cards: CardDef[] = [
  {
    id: 'metoo',
    group: 'topic',
    icon: 'far fa-hand',
    title: () => trans(`${KEY}.title`),
    description: () => trans(`${KEY}.enabled_help`),
    keywords: 'me too eu também mão hand problema compartilhado shared issue suporte support bug votar voto',
    master: 'canela.metoo_enabled',
    body: () => (
      <>
        {isExtensionEnabled('flarum-tags') && <AdminTagPicker />}
        {toggle('hide_solved', 'fof-best-answer')}
        {toggle('follow', 'flarum-subscriptions')}
        {!isExtensionEnabled('fof-best-answer') && <AdminNotice>{trans(`${KEY}.no_best_answer_notice`)}</AdminNotice>}
      </>
    ),
  },
];

export default cards;
