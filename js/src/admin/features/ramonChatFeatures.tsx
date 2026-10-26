/*
 * Card dos recursos de chat que o tema põe por cima do ramon/chat
 * (extend/ramonchat.php + js/src/forum/thirdparty/ramonChat/features): uma
 * chave por recurso, todas `canela.ramonchat_*`, e o limite de participantes
 * das MDs. Sem o ramon/chat o card fica trancado; se extend/ramonchat.php não
 * carregou (ver o log de erros), também: os padrões só existem com ele.
 */
import app from 'flarum/admin/app';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

import AdminNumber from '../components/AdminNumber';
import AdminToggle from '../components/AdminToggle';
import { trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.ramon_chat_features';
const MASTER = 'canela.ramonchat_features';

const toggle = (name: string, dependsOn?: string) => (
  <AdminToggle
    settingKey={`canela.ramonchat_${name}`}
    label={trans(`${KEY}.${name}_label`)}
    help={trans(`${KEY}.${name}_help`)}
    dependsOn={dependsOn}
  />
);

const heading = (name: string) => <h4 className="CanelaAdmin-subTitle">{trans(`${KEY}.${name}`)}</h4>;

const cards: CardDef[] = [
  {
    id: 'ramon-chat-features',
    group: 'messages',
    icon: 'fas fa-comments',
    title: () => trans(`${KEY}.title`),
    description: () => trans(`${KEY}.description`),
    keywords:
      'chat ramon recursos extras sino notificações reações favoritos estrela nova mensagem grupo link restaurar digitando atalho preferências denúncias revisar flags moderação',
    master: MASTER,
    extensions: ['ramon-chat'],
    lockedBy: () => (isExtensionEnabled('ramon-chat') && app.data.settings[MASTER] === undefined ? trans(`${KEY}.backend_off`) : null),
    body: () => [
      heading('group_reader'),
      toggle('preferences'),
      toggle('header_indicator'),
      toggle('drawer_shortcut'),
      toggle('bell'),

      heading('group_messages'),
      toggle('quick_reactions'),
      toggle('permalink'),
      toggle('restore'),
      toggle('long_press'),
      toggle('collapse_deleted'),
      toggle('paste_upload'),
      toggle('mention_warning'),
      toggle('typing_poll'),

      heading('group_channels'),
      toggle('new_message'),
      toggle('self_dm'),
      toggle('group_name'),
      toggle('starred'),
      toggle('pin_bar'),
      toggle('pin_indicator'),
      toggle('retention'),
      toggle('delete_confirm'),
      toggle('auto_join'),
      toggle('tag_cleanup'),

      heading('group_moderation'),
      toggle('review_flags'),
      toggle('dm_guard'),
      <AdminNumber
        settingKey="canela.ramonchat_dm_max"
        label={trans(`${KEY}.dm_max_label`)}
        help={trans(`${KEY}.dm_max_help`)}
        min={2}
        max={20}
        fallback={20}
      />,
    ],
  },
];

export default cards;
