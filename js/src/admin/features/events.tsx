/*
 * Cards dos eventos (extend/events.php) e da sintaxe a mais do conteúdo
 * (extend/cooked.php: notas de rodapé e sumário), no grupo "Tópico".
 *
 * Eventos: o liga/desliga no cabeçalho, a tag onde os eventos valem (quem pode
 * começar discussão nela pode criar evento), a data na lista, "Próximos
 * eventos", o chat do evento (ramon/chat) e o lembrete.
 */
import app from 'flarum/admin/app';
import Component from 'flarum/common/Component';
import type Mithril from 'mithril';

import { AdminNotice } from '../components/AdminCard';
import AdminNumber from '../components/AdminNumber';
import AdminToggle from '../components/AdminToggle';
import { getBool, getStr, saveSetting, trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.events';
const COOKED = 'ramon-canela.admin.settings.cooked';

const toggle = (name: string, label: string, help: string, extra: Record<string, unknown> = {}) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} {...extra} />
);

const eventsOff = (): string | null =>
  getBool('canela.events_backend')
    ? null
    : trans(`${KEY}.backend_off`, 'O backend dos eventos (extend/events.php) ainda não está carregado no servidor.');

const cookedOff = (): string | null =>
  getBool('canela.cooked_backend')
    ? null
    : trans(`${COOKED}.backend_off`, 'A sintaxe das notas e do sumário (extend/cooked.php) ainda não está carregada no servidor.');

interface AdminTag {
  id(): string | undefined;
  name(): string;
  position(): number | null;
  isChild(): boolean;
}

/** As tags do fórum, carregadas uma vez para os seletores. */
let tagsLoading = false;

function allTags(): AdminTag[] {
  const tags = app.store.all<any>('tags') as AdminTag[];

  if (!tags.length && !tagsLoading && 'flarum-tags' in flarum.extensions) {
    tagsLoading = true;
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

/** A tag dos eventos: uma só, ou nenhuma (qualquer discussão). */
class EventsTagSelect extends Component {
  view(): Mithril.Children {
    const value = getStr('canela.events_tag', '');

    return (
      <div className="Form-group">
        <label className="CanelaAdmin-label">{trans(`${KEY}.events_tag_label`, 'Tag dos eventos')}</label>
        <div className="CanelaAdmin-select-wrap">
          <select
            className="FormControl CanelaAdmin-select"
            value={value}
            onchange={(event: Event) => {
              const next = (event.target as HTMLSelectElement).value;
              app.data.settings['canela.events_tag'] = next;
              m.redraw();
              saveSetting({ 'canela.events_tag': next });
            }}
          >
            <option value="">{trans(`${KEY}.events_tag_any`, 'Qualquer tag')}</option>
            {allTags().map((tag) => (
              <option value={tag.id()}>{tag.isChild() ? `— ${tag.name()}` : tag.name()}</option>
            ))}
          </select>
          <i className="fas fa-chevron-down CanelaAdmin-select-chevron" aria-hidden="true" />
        </div>
        <p className="helpText">
          {trans(
            `${KEY}.events_tag_help`,
            'O botão "Criar evento" só aparece ao criar uma discussão nesta tag, e só as discussões dela mostram o cartão do evento, entram em "Próximos eventos" e mandam lembrete. Quem pode criar evento é quem pode começar discussão na tag (as permissões da própria tag). Em "Qualquer tag", vale em todas as discussões.'
          )}
        </p>
      </div>
    );
  }
}

/** As tags em que o sumário aparece sozinho, sem o [toc] no post. */
class TocTagsPicker extends Component {
  view(): Mithril.Children {
    const selected = new Set(
      getStr('canela.toc_auto_tags', '')
        .split(/[\s,|]+/)
        .filter(Boolean)
    );
    const save = () => {
      const value = [...selected].join(',');
      app.data.settings['canela.toc_auto_tags'] = value;
      m.redraw();
      saveSetting({ 'canela.toc_auto_tags': value });
    };

    return (
      <div className="Form-group">
        <label className="CanelaAdmin-label">{trans(`${COOKED}.toc_auto_tags_label`, 'Sumário automático nestas tags')}</label>
        <div className="CanelaAdmin-chips">
          {allTags().map((tag) => {
            const id = String(tag.id());
            const on = selected.has(id);

            return (
              <label className={`CanelaAdmin-chip${on ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onchange={() => {
                    if (on) selected.delete(id);
                    else selected.add(id);
                    save();
                  }}
                />{' '}
                {tag.name()}
              </label>
            );
          })}
        </div>
        <p className="helpText">
          {trans(
            `${COOKED}.toc_auto_tags_help`,
            'Nas discussões destas tags, o primeiro post ganha o sumário mesmo sem o [toc] (desde que tenha títulos suficientes).'
          )}
        </p>
      </div>
    );
  }
}

const cards: CardDef[] = [
  {
    id: 'events',
    group: 'topic',
    icon: 'far fa-calendar',
    title: () => trans(`${KEY}.title`, 'Eventos'),
    description: () =>
      trans(
        `${KEY}.events_enabled_help`,
        'O "Criar evento" no menu ⊕ do composer põe um evento no primeiro post: data, hora e fuso, recorrência, endereço da transmissão, local e limite de vagas. O post mostra o cartão com "Eu vou", "Interessado" e "Não vou", os participantes e o "Adicionar à agenda" (Google e .ics). Desligado, o cartão vira texto e a API responde como se o recurso não existisse.'
      ),
    keywords: 'eventos events calendário calendar agenda rsvp presença vou interessado recorrência lembrete reminder transmissão livestream',
    master: 'canela.events_enabled',
    lockedBy: eventsOff,
    body: () => (
      <>
        <EventsTagSelect />
        {toggle(
          'events_list_badge',
          'Data na lista e no cabeçalho',
          'A data do evento ("em 3 dias", "há 2 dias") ao lado do título na lista de discussões e no cabeçalho do tópico.'
        )}
        {toggle(
          'events_upcoming',
          'Próximos eventos',
          'O link "Eventos" na barra lateral, a página /events (lista e calendário) e, no topo da lista da tag dos eventos, as próximas datas.'
        )}
        {toggle(
          'events_chat',
          'Chat do evento',
          'O construtor ganha a opção "Chat do evento": um canal do ramon/chat só para o evento, preso à tag da discussão; quem marca "Eu vou" entra no canal.',
          { extension: 'ramon-chat' }
        )}
        {toggle(
          'events_docked_chat',
          'Chat ao lado do tópico',
          'No computador, o canal do evento fica numa coluna à direita do tópico, da altura da tela. No celular e no tablet, o cartão tem o link para o chat.',
          { dependsOn: 'canela.events_chat', extension: 'ramon-chat' }
        )}
        <AdminNumber
          settingKey="canela.events_reminder_minutes"
          label={trans(`${KEY}.events_reminder_minutes_label`, 'Lembrete antes do evento')}
          help={trans(
            `${KEY}.events_reminder_minutes_help`,
            'Quantos minutos antes de cada ocorrência quem marcou "Eu vou" recebe o alerta. Zero desliga o lembrete.'
          )}
          min={0}
          max={10080}
          fallback={15}
          suffix={trans(`${KEY}.minutes`, 'min')}
        />
        <AdminNotice icon="far fa-clock">
          {trans(
            `${KEY}.reminders_notice`,
            'Os lembretes saem pelo agendador do Flarum, a cada cinco minutos: o servidor precisa rodar "php flarum schedule:run" pelo cron a cada minuto.'
          )}
        </AdminNotice>
      </>
    ),
  },
  {
    id: 'footnotes',
    group: 'topic',
    icon: 'fas fa-asterisk',
    title: () => trans(`${COOKED}.footnotes_title`, 'Notas de rodapé'),
    description: () =>
      trans(
        `${COOKED}.footnotes_help`,
        'Notas de rodapé: "texto[^1]" com "[^1]: a nota" no fim do post, ou a nota em linha "^[a nota]". O número aparece pequeno, acima da linha, e o clique abre a nota numa dica. O menu ⊕ do composer ganha "Nota de rodapé". Desligado, as notas ficam como "[1]" e "[1]: texto".'
      ),
    keywords: 'notas de rodapé footnotes nota referência rodapé',
    master: 'canela.footnotes',
    lockedBy: cookedOff,
  },
  {
    id: 'toc',
    group: 'topic',
    icon: 'fas fa-list-ul',
    title: () => trans(`${COOKED}.toc_title`, 'Sumário'),
    description: () =>
      trans(
        `${COOKED}.toc_help`,
        'Com [toc] no primeiro post (o menu ⊕ do composer tem "Inserir sumário"), os títulos dele aparecem na coluna da linha do tempo, com o título em que se está marcado e "Ir para o fim". O botão embaixo troca entre "Conteúdo" e "Linha de tempo", e a escolha fica no navegador. No celular, o sumário fica na folha da linha do tempo.'
      ),
    keywords: 'sumário toc índice table of contents conteúdo títulos headings linha do tempo timeline',
    master: 'canela.toc',
    lockedBy: cookedOff,
    body: () => (
      <>
        <AdminNumber
          settingKey="canela.toc_min_headings"
          label={trans(`${COOKED}.toc_min_headings_label`, 'Mínimo de títulos')}
          help={trans(`${COOKED}.toc_min_headings_help`, 'Com menos títulos que isso no primeiro post, o sumário não aparece.')}
          min={1}
          max={50}
          fallback={3}
        />
        <TocTagsPicker />
      </>
    ),
  },
];

export default cards;
