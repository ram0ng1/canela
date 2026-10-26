/*
 * Card dos Marcadores no grupo "Tópico": o liga/desliga do recurso no
 * cabeçalho e, com ele ligado, onde os atalhos aparecem. O botão do post não
 * tem opção própria — é o coração do recurso, e desligar o recurso inteiro já
 * o tira.
 */
import { AdminNotice } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import { trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.bookmarks';

const toggle = (name: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} />
);

const cards: CardDef[] = [
  {
    id: 'bookmarks',
    group: 'topic',
    icon: 'far fa-bookmark',
    title: () => trans(`${KEY}.title`),
    description: () => trans(`${KEY}.bookmarks_enabled_help`),
    keywords: 'marcadores bookmarks favoritos salvar lembrete lembretes reminder',
    master: 'canela.bookmarks_enabled',
    body: () => (
      <>
        {toggle('bookmarks_topic_button')}
        {toggle('bookmarks_user_menu')}
        <AdminNotice icon="far fa-clock">{trans(`${KEY}.reminders_notice`)}</AdminNotice>
      </>
    ),
  },
];

export default cards;
