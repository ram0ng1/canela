/*
 * Card do "Me too" no grupo "Tópico": o liga/desliga, em quais categorias e
 * etiquetas o botão aparece (no Discourse, só nas categorias de suporte; aqui
 * o padrão é todas), se some com a melhor resposta e se quem marca passa a
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

const toggle = (name: string, label: string, help: string, extension?: string) => (
  <AdminToggle
    settingKey={`canela.metoo_${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, help)}
    extension={extension}
  />
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
 * fórum novo ganha o botão em todo tópico, e quem quer o comportamento do
 * Meta (só Suporte, Bug…) marca as dele.
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
        <label>{trans(`${KEY}.tags_label`, 'Onde o botão aparece')}</label>
        <p className="helpText">
          {trans(
            `${KEY}.tags_help`,
            'Marque as tags de suporte (no Meta do Discourse: Support, Bug…). Nenhuma marcada vale para todas as discussões. Marcar uma tag pai inclui as filhas.'
          )}
        </p>

        {!tagRows ? (
          <p className="helpText">{trans(`${KEY}.tags_loading`, 'Carregando as tags…')}</p>
        ) : (
          <>
            <p className="CanelaAdmin-tagPicker-summary">
              {selected.size
                ? trans(`${KEY}.tags_some`, '{count} selecionada(s)', { count: selected.size })
                : trans(`${KEY}.tags_all`, 'Todas as tags')}
              {selected.size > 0 && (
                <button type="button" className="Button Button--link" onclick={() => save(new Set())}>
                  {trans(`${KEY}.tags_clear`, 'Limpar (todas)')}
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
    title: () => trans(`${KEY}.title`, 'Eu também (Me too)'),
    description: () =>
      trans(
        `${KEY}.enabled_help`,
        'A pílula "✋ Eu também" abaixo do primeiro post, como no Meta do Discourse: quem tem o mesmo problema clica, a contagem aparece entre parênteses e a pessoa passa a acompanhar a discussão. O autor e as discussões trancadas veem o botão só para leitura; visitantes são levados ao login. Desligado, o botão some e a API responde 404; as marcações ficam guardadas.'
      ),
    keywords: 'me too eu também mão hand problema compartilhado shared issue suporte support bug votar voto',
    master: 'canela.metoo_enabled',
    body: () => (
      <>
        {isExtensionEnabled('flarum-tags') && <AdminTagPicker />}
        {toggle(
          'hide_solved',
          'Esconder quando a discussão tiver solução',
          'Com a melhor resposta escolhida (FoF Best Answer), o botão some, e volta se a solução for retirada, o padrão do Discourse. Desligado, continua na discussão resolvida (o "várias soluções" do plugin).',
          'fof-best-answer'
        )}
        {toggle(
          'follow',
          'Quem marca passa a seguir a discussão',
          'Ao clicar em "Eu também", a pessoa passa a seguir a discussão (extensão Inscrições) para saber da solução, como o "Acompanhando" do Discourse. Quem já segue continua igual; desmarcar não deixa de seguir.',
          'flarum-subscriptions'
        )}
        {!isExtensionEnabled('fof-best-answer') && (
          <AdminNotice>
            {trans(
              `${KEY}.no_best_answer_notice`,
              'Sem a extensão FoF Best Answer, nenhuma discussão conta como resolvida: o botão fica em todas as discussões escolhidas.'
            )}
          </AdminNotice>
        )}
      </>
    ),
  },
];

export default cards;
