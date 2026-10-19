/*
 * Cards do Chat no grupo "Mensagens e chat" — as configurações de chat do
 * Discourse: ligar/desligar (no cabeçalho do card Chat), quem usa, quem cria
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

const toggle = (name: string, label: string, help: string, dependsOn?: string) => (
  <AdminToggle
    settingKey={`canela.${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, help)}
    dependsOn={dependsOn}
  />
);

const number = (name: string, label: string, help: string, min: number, max: number, fallback: number, suffix?: string) => (
  <AdminNumber
    settingKey={`canela.${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, help)}
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

const groups = (name: string, label: string, help: string, fallback: string) => (
  <AdminGroups
    settingKey={`canela.${name}`}
    fallback={fallback}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, help)}
    adminNote={trans(`${KEY}.admins_always`, 'Os administradores sempre podem.')}
  />
);

const realtimeOn = () => isExtensionEnabled('flarum-realtime');

const CHAT = 'canela.chat_enabled';

const cards: CardDef[] = [
  {
    id: 'chat',
    group: 'messages',
    icon: 'far fa-message',
    title: () => trans(`${KEY}.title`, 'Chat'),
    description: () =>
      trans(
        `${KEY}.chat_enabled_help`,
        'O chat do Discourse: canais públicos (avulsos ou de uma tag), mensagens diretas, fios, reações, menções e imagens, com o ícone no cabeçalho, a gaveta no canto da tela e a página /chat. Desligado, tudo some do fórum e a API responde como se o recurso não existisse, as mensagens ficam guardadas.'
      ),
    keywords: 'chat conversa mensagens canais mensagem direta md dm tempo real realtime websocket gaveta',
    master: CHAT,
    // Com o ramon/chat habilitado, o chat do tema dá lugar a ele (o backend
    // nem carrega) e o tema só adapta o visual e a barra lateral.
    lockedBy: () =>
      isExtensionEnabled('ramon-chat')
        ? trans(
            `${KEY}.replaced_by_ramon_chat`,
            'O ramon/chat está habilitado: ele substitui o chat do tema, que fica desligado. O tema adapta o visual e a barra lateral dele.'
          )
        : null,
    body: () => (
      <>
        {groups(
          'chat_allowed_groups',
          'Quem pode usar o chat',
          'Os grupos que veem o chat. Cada pessoa ainda pode desligá-lo nas próprias configurações.',
          '3'
        )}
        {toggle(
          'chat_sidebar',
          'Seções na barra lateral',
          'As seções "Canais" e "Mensagens diretas" na barra lateral, abaixo das tags, com as não lidas e as menções.',
          'canela.sidebar_enabled'
        )}
        <AdminNotice icon="fas fa-bolt">
          {realtimeOn()
            ? trans(
                `${KEY}.realtime_on`,
                'As mensagens chegam em tempo real pelo websocket do flarum/realtime ("php flarum realtime:serve" precisa estar rodando). Se ele cair, o chat passa sozinho a perguntar ao servidor a cada poucos segundos.'
              )
            : trans(
                `${KEY}.realtime_off`,
                'Sem o flarum/realtime, o chat pergunta ao servidor a cada poucos segundos se há mensagens novas. Funciona, mas com um pequeno atraso e mais requisições: para tempo real, ative o flarum/realtime e rode "php flarum realtime:serve".'
              )}
        </AdminNotice>
      </>
    ),
  },
  {
    id: 'chat-channels',
    group: 'messages',
    icon: 'fas fa-hashtag',
    title: () => trans(`${KEY}.channels_only_title`, 'Canais do chat'),
    keywords: 'chat canais criar canal grupo moderação moderar fixar fixadas fios threads',
    dependsOn: CHAT,
    body: () => (
      <>
        {groups(
          'chat_create_channel_groups',
          'Quem cria canais públicos',
          'Além dos administradores. Um canal pode ficar ligado a uma tag: aí só quem enxerga a tag enxerga o canal.',
          ''
        )}
        <SubDivider />
        {groups(
          'chat_moderator_groups',
          'Quem modera o chat',
          'Apagam e restauram mensagens dos outros, fixam mensagens e fecham, arquivam ou excluem canais. As mensagens diretas não têm moderação: ninguém lê as conversas dos outros.',
          '4'
        )}
        <SubDivider />
        {toggle(
          'chat_threads_enabled',
          'Fios',
          'Responder a uma mensagem abre uma conversa à parte, no painel ao lado. Cada canal ainda liga ou desliga os fios nas configurações dele.'
        )}
        {toggle(
          'chat_pins_enabled',
          'Mensagens fixadas',
          'A moderação fixa até 20 mensagens por canal (numa MD, qualquer participante), que aparecem na faixa do topo da conversa.'
        )}
      </>
    ),
  },
  {
    id: 'chat-dm',
    group: 'messages',
    icon: 'far fa-comments',
    title: () => trans(`${KEY}.chat_dm_enabled_label`, 'Mensagens diretas'),
    description: () =>
      trans(
        `${KEY}.chat_dm_enabled_help`,
        'Conversas privadas entre duas pessoas ou em grupo, abertas por "Nova mensagem" ou pelo botão "Chat" do perfil.'
      ),
    keywords: 'chat mensagem direta md dm privada grupo participantes',
    master: 'canela.chat_dm_enabled',
    dependsOn: CHAT,
    body: () => (
      <>
        {groups('chat_dm_groups', 'Quem pode abrir mensagens diretas', 'O "direct_message_enabled_groups" do Discourse.', '3')}
        {number('chat_dm_max_users', 'Participantes por conversa', 'O máximo de pessoas num chat em grupo, contando quem cria.', 2, 100, 20)}
      </>
    ),
  },
  {
    id: 'chat-limits',
    group: 'messages',
    icon: 'fas fa-sliders',
    title: () => trans(`${KEY}.limits_title`, 'Mensagens, anexos e retenção'),
    keywords: 'chat tamanho mensagem caracteres anexos imagens upload retenção apagar dias polling',
    dependsOn: CHAT,
    body: () => (
      <>
        {number(
          'chat_max_message_length',
          'Tamanho máximo da mensagem',
          'Em caracteres. O padrão do Discourse é 6000.',
          50,
          50000,
          6000,
          trans(`${KEY}.chars`, 'caracteres')
        )}
        <SubDivider />
        {toggle(
          'chat_uploads_enabled',
          'Imagens nas mensagens',
          'O "+" do composer, colar e arrastar imagens (JPG, PNG, GIF e WebP), com a mesma validação do avatar. Ficam em public/assets/canela-chat.'
        )}
        {getBool('canela.chat_uploads_enabled') && (
          <AdminSubGroup>{number('chat_upload_max_kb', 'Tamanho máximo da imagem', 'Por arquivo.', 64, 51200, 4096, 'KB')}</AdminSubGroup>
        )}
        <SubDivider />
        {number(
          'chat_retention_days',
          'Retenção dos canais',
          'Mensagens dos canais públicos mais velhas que isso são apagadas de vez, uma vez por dia. 0 guarda para sempre.',
          0,
          3650,
          0,
          trans(`${KEY}.days`, 'dias')
        )}
        {when(
          'canela.chat_dm_enabled',
          number(
            'chat_dm_retention_days',
            'Retenção das mensagens diretas',
            'O mesmo para as MDs. 0 guarda para sempre.',
            0,
            3650,
            0,
            trans(`${KEY}.days`, 'dias')
          )
        )}
        <AdminNotice icon="far fa-clock">
          {trans(
            `${KEY}.retention_notice`,
            'A limpeza roda pelo agendador do Flarum ("php flarum schedule:run" no cron a cada minuto), e também apaga as imagens enviadas que nunca viraram mensagem.'
          )}
        </AdminNotice>
        {/* Sem o websocket o chat pergunta ao servidor; com ele, o intervalo só vale se o websocket cair. */}
        <SubDivider />
        {number(
          'chat_poll_seconds',
          'Intervalo sem tempo real',
          'Sem o websocket, de quantos em quantos segundos a conversa aberta pergunta por mensagens novas.',
          2,
          120,
          5,
          's'
        )}
      </>
    ),
  },
];

export default cards;
