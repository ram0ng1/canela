/*
 * Cards do Chat no grupo "Mensagens e chat" — as configurações de chat:
 * ligar/desligar (no cabeçalho do card Chat), quem usa, quem cria
 * canais, mensagens diretas, fios, fixadas, anexos, tamanho da mensagem e
 * retenção. Os outros cards dependem do Chat: com ele desligado, somem.
 *
 * As listas de grupos (`chat_allowed_groups` e companhia) são caixas de
 * marcar com os grupos do fórum, gravadas como "3,4" — o formato que o
 * ChatSettings lê.
 */
import app from 'flarum/admin/app';
import Checkbox from 'flarum/common/components/Checkbox';
import type Group from 'flarum/common/models/Group';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

import { AdminNotice, AdminSubGroup, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminNumber from '../components/AdminNumber';
import { AdminComponent, getBool, getStr, saveSetting, trans, when } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.chat';

const toggle = (name: string, dependsOn?: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} dependsOn={dependsOn} />
);

const number = (name: string, min: number, max: number, fallback: number, suffix?: string) => (
  <AdminNumber
    settingKey={`canela.${name}`}
    label={trans(`${KEY}.${name}_label`)}
    help={trans(`${KEY}.${name}_help`)}
    min={min}
    max={max}
    fallback={fallback}
    suffix={suffix}
  />
);

/** Os grupos do fórum como caixas de marcar; "Visitantes" fica de fora (o chat pede login). */
class AdminGroups extends AdminComponent {
  view() {
    const { settingKey, label, help, fallback = '', adminNote } = this.attrs;
    const selected = new Set(
      getStr(settingKey, fallback)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    );
    const groups = (app.store.all('groups') as Group[]).filter((group) => group.id() !== '2');

    return (
      <div className="Form-group CanelaAdmin-groups">
        <label className="CanelaAdmin-label">{label}</label>
        <div className="CanelaAdmin-groupList">
          {groups.map((group) => {
            const id = group.id()!;
            const isAdmin = id === '1';

            return (
              <Checkbox
                key={id}
                state={isAdmin || selected.has(id)}
                disabled={isAdmin}
                onchange={(checked: boolean) => {
                  if (checked) selected.add(id);
                  else selected.delete(id);

                  const value = [...selected].filter((g) => g !== '1').join(',');
                  app.data.settings[settingKey] = value;
                  m.redraw();
                  saveSetting({ [settingKey]: value });
                }}
              >
                {group.namePlural()}
              </Checkbox>
            );
          })}
        </div>
        {help && <p className="helpText">{help}</p>}
        {adminNote && <p className="helpText">{adminNote}</p>}
      </div>
    );
  }
}

const groups = (name: string, fallback: string) => (
  <AdminGroups
    settingKey={`canela.${name}`}
    fallback={fallback}
    label={trans(`${KEY}.${name}_label`)}
    help={trans(`${KEY}.${name}_help`)}
    adminNote={trans(`${KEY}.admins_always`)}
  />
);

const realtimeOn = () => isExtensionEnabled('flarum-realtime');

const CHAT = 'canela.chat_enabled';

const cards: CardDef[] = [
  {
    id: 'chat',
    group: 'messages',
    icon: 'far fa-message',
    title: () => trans(`${KEY}.title`),
    description: () => trans(`${KEY}.chat_enabled_help`),
    keywords: 'chat conversa mensagens canais mensagem direta md dm tempo real realtime websocket gaveta',
    master: CHAT,
    // Com o ramon/chat habilitado, o chat do tema dá lugar a ele (o backend
    // nem carrega) e o tema só adapta o visual e a barra lateral.
    lockedBy: () => (isExtensionEnabled('ramon-chat') ? trans(`${KEY}.replaced_by_ramon_chat`) : null),
    body: () => (
      <>
        {groups('chat_allowed_groups', '3')}
        {toggle('chat_sidebar', 'canela.sidebar_enabled')}
        <AdminNotice icon="fas fa-bolt">{realtimeOn() ? trans(`${KEY}.realtime_on`) : trans(`${KEY}.realtime_off`)}</AdminNotice>
      </>
    ),
  },
  {
    id: 'chat-channels',
    group: 'messages',
    icon: 'fas fa-hashtag',
    title: () => trans(`${KEY}.channels_only_title`),
    keywords: 'chat canais criar canal grupo moderação moderar fixar fixadas fios threads',
    dependsOn: CHAT,
    body: () => (
      <>
        {groups('chat_create_channel_groups', '')}
        <SubDivider />
        {groups('chat_moderator_groups', '4')}
        <SubDivider />
        {toggle('chat_threads_enabled')}
        {toggle('chat_pins_enabled')}
      </>
    ),
  },
  {
    id: 'chat-dm',
    group: 'messages',
    icon: 'far fa-comments',
    title: () => trans(`${KEY}.chat_dm_enabled_label`),
    description: () => trans(`${KEY}.chat_dm_enabled_help`),
    keywords: 'chat mensagem direta md dm privada grupo participantes',
    master: 'canela.chat_dm_enabled',
    dependsOn: CHAT,
    body: () => (
      <>
        {groups('chat_dm_groups', '3')}
        {number('chat_dm_max_users', 2, 100, 20)}
      </>
    ),
  },
  {
    id: 'chat-limits',
    group: 'messages',
    icon: 'fas fa-sliders',
    title: () => trans(`${KEY}.limits_title`),
    keywords: 'chat tamanho mensagem caracteres anexos imagens upload retenção apagar dias polling',
    dependsOn: CHAT,
    body: () => (
      <>
        {number('chat_max_message_length', 50, 50000, 6000, trans(`${KEY}.chars`))}
        <SubDivider />
        {toggle('chat_uploads_enabled')}
        {getBool('canela.chat_uploads_enabled') && <AdminSubGroup>{number('chat_upload_max_kb', 64, 51200, 4096, 'KB')}</AdminSubGroup>}
        <SubDivider />
        {number('chat_retention_days', 0, 3650, 0, trans(`${KEY}.days`))}
        {when('canela.chat_dm_enabled', number('chat_dm_retention_days', 0, 3650, 0, trans(`${KEY}.days`)))}
        <AdminNotice icon="far fa-clock">{trans(`${KEY}.retention_notice`)}</AdminNotice>
        {/* Sem o websocket o chat pergunta ao servidor; com ele, o intervalo só vale se o websocket cair. */}
        <SubDivider />
        {number('chat_poll_seconds', 2, 120, 5, 's')}
      </>
    ),
  },
];

export default cards;
