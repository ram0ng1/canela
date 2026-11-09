/*
 * A aba "Assistente": a conta do assistente de IA (separada da do sistema),
 * quando ele responde (tópico atribuído a ele, ou sozinho nas tags
 * escolhidas), o padrão da resposta e as ações (mencionar, citar, curtir,
 * esperar antes de responder). As chaves são `canela.assistant_*`, de
 * extend/assign.php (a classe AssistantBot).
 */
import app from 'flarum/admin/app';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

import { AdminNotice } from '../components/AdminCard';
import AdminSelect from '../components/AdminSelect';
import AdminNumber from '../components/AdminNumber';
import AdminTagPicker from '../components/AdminTagPicker';
import AdminToggle from '../components/AdminToggle';
import AdminTextarea from './AdminTextarea';
import AssistantCard from './assign';
import { requiresProvider } from './ai';
import { getStr, trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.assistant';
const AI = 'canela.ai_enabled';

/** Sem a IA configurada ou sem a conta criada, o card fica trancado. */
const needsAccount = (): string | null => requiresProvider() ?? (app.forum.attribute('canelaAssistant') ? null : trans(`${KEY}.needs_account`));

/** As personas ligadas, como no editor da aba IA (as padrões, se o admin não mexeu). */
function personaOptions(): Record<string, string> {
  let list: { id: string; name: string; enabled: boolean }[] = [];

  try {
    list = JSON.parse(getStr('canela.ai_personas') || '[]');
  } catch {
    list = [];
  }

  if (!Array.isArray(list) || !list.length) list = app.forum.attribute<any[]>('canelaAiDefaultPersonas') || [];

  return {
    '': trans(`${KEY}.persona_default`),
    ...Object.fromEntries(list.filter((persona) => persona.enabled).map((persona) => [persona.id, persona.name])),
  };
}

const cards: CardDef[] = [
  {
    id: 'assistant-account',
    group: 'assistant',
    icon: 'fas fa-robot',
    title: () => trans(`${KEY}.account_title`),
    description: () => trans(`${KEY}.account_help`),
    keywords: 'assistente assistant bot ia ai claude conta account perfil profile',
    dependsOn: AI,
    lockedBy: requiresProvider,
    body: () => <AssistantCard />,
  },
  {
    id: 'assistant-assign',
    group: 'assistant',
    icon: 'fas fa-user-check',
    title: () => trans(`${KEY}.on_assign_label`),
    description: () => trans(`${KEY}.on_assign_help`),
    keywords: 'assistente assistant atribuir assign responder reply',
    master: 'canela.assistant_on_assign',
    dependsOn: [AI, 'canela.assign_enabled'],
    lockedBy: needsAccount,
  },
  {
    id: 'assistant-auto',
    group: 'assistant',
    icon: 'fas fa-reply-all',
    title: () => trans(`${KEY}.auto_label`),
    description: () => trans(`${KEY}.auto_help`),
    keywords: 'assistente assistant automático automatic responder reply tags categorias suporte support modo mode',
    master: 'canela.assistant_auto',
    dependsOn: AI,
    lockedBy: needsAccount,
    body: () =>
      isExtensionEnabled('flarum-tags') ? (
        <>
          <AdminTagPicker settingKey="canela.assistant_auto_tags" transKey={KEY} />
          <AdminSelect
            settingKey="canela.assistant_auto_mode"
            label={trans(`${KEY}.mode_label`)}
            help={trans(`${KEY}.mode_help`)}
            options={{ first: trans(`${KEY}.mode_first`), all: trans(`${KEY}.mode_all`) }}
          />
        </>
      ) : (
        <AdminNotice>{trans(`${KEY}.no_tags`)}</AdminNotice>
      ),
  },
  {
    id: 'assistant-style',
    group: 'assistant',
    icon: 'fas fa-pen-nib',
    title: () => trans(`${KEY}.style_title`),
    description: () => trans(`${KEY}.style_help`),
    keywords: 'assistente assistant padrão pattern estilo style persona tamanho length instruções instructions prompt',
    dependsOn: AI,
    lockedBy: needsAccount,
    body: () => (
      <>
        <AdminSelect
          settingKey="canela.assistant_persona"
          label={trans(`${KEY}.persona_label`)}
          help={trans(`${KEY}.persona_help`)}
          options={personaOptions()}
        />
        <AdminSelect
          settingKey="canela.assistant_length"
          label={trans(`${KEY}.length_label`)}
          help={trans(`${KEY}.length_help`)}
          default="medium"
          options={{ short: trans(`${KEY}.length_short`), medium: trans(`${KEY}.length_medium`), long: trans(`${KEY}.length_long`) }}
        />
        <AdminTextarea
          settingKey="canela.assistant_instructions"
          label={trans(`${KEY}.instructions_label`)}
          help={trans(`${KEY}.instructions_help`)}
          placeholder={trans(`${KEY}.instructions_placeholder`)}
          rows={4}
        />
      </>
    ),
  },
  {
    id: 'assistant-actions',
    group: 'assistant',
    icon: 'fas fa-hand-pointer',
    title: () => trans(`${KEY}.actions_title`),
    description: () => trans(`${KEY}.actions_help`),
    keywords: 'assistente assistant mencionar mention citar quote curtir like esperar delay minutos minutes natural',
    dependsOn: AI,
    lockedBy: needsAccount,
    body: () => (
      <>
        {(['mention', 'quote', 'like'] as const).map((name) => (
          <AdminToggle
            settingKey={`canela.assistant_${name}`}
            label={trans(`${KEY}.${name}_label`)}
            help={trans(`${KEY}.${name}_help`)}
            extension={name === 'like' ? 'flarum-likes' : 'flarum-mentions'}
          />
        ))}
        <AdminNumber
          settingKey="canela.assistant_delay"
          label={trans(`${KEY}.delay_label`)}
          help={trans(`${KEY}.delay_help`)}
          min={0}
          max={1440}
          fallback={0}
          suffix={trans(`${KEY}.delay_suffix`)}
        />
      </>
    ),
  },
];

export default cards;
