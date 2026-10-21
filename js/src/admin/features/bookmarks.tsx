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

const toggle = (name: string, label: string, help: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} />
);

const cards: CardDef[] = [
  {
    id: 'bookmarks',
    group: 'topic',
    icon: 'far fa-bookmark',
    title: () => trans(`${KEY}.title`, 'Marcadores'),
    description: () =>
      trans(
        `${KEY}.bookmarks_enabled_help`,
        'Cada usuário marca posts para voltar depois, com um nome e um lembrete opcionais, e encontra todos na aba "Marcadores" do próprio perfil. Desligado, os botões somem e a API responde como se o recurso não existisse, os marcadores já criados ficam guardados.'
      ),
    keywords: 'marcadores bookmarks favoritos salvar lembrete lembretes reminder',
    master: 'canela.bookmarks_enabled',
    body: () => (
      <>
        {toggle(
          'bookmarks_topic_button',
          'Marcar discussão',
          'Acrescenta "Marcar discussão" aos controles da discussão (o menu "…" do rodapé). Marca o primeiro post.'
        )}
        {toggle('bookmarks_user_menu', 'Item no menu do usuário', 'Um atalho "Marcadores" no menu do avatar, logo abaixo de "Perfil".')}
        <AdminNotice icon="far fa-clock">
          {trans(
            `${KEY}.reminders_notice`,
            'Os lembretes saem pelo agendador do Flarum, a cada cinco minutos: o servidor precisa rodar "php flarum schedule:run" pelo cron a cada minuto. Sem o cron, os marcadores funcionam, mas nenhum lembrete é enviado.'
          )}
        </AdminNotice>
      </>
    ),
  },
];

export default cards;
