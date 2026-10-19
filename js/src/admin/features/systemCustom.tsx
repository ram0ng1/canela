/*
 * As mensagens automáticas personalizadas (setting `canela.sysmsg_custom`,
 * JSON; ver src/System/Messages/CustomMessages.php): cada uma com um título,
 * um gatilho (conta ativada, N dias depois, grupo, nível de confiança,
 * emblema, primeira postagem, conta verificada), o assunto e o texto. O id e
 * a data de criação nascem aqui, ao adicionar: o servidor só limpa o JSON.
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

import { AdminComponent, getStr, saveSetting, trans } from '../util';
import { AdminSwitch } from '../components/AdminSwitch';
import { loadBadges } from './badgesAdmin/api';

const KEY = 'ramon-canela.admin.sysmsg.custom';
const FIELDS = 'ramon-canela.admin.sysmsg.fields';
const SETTING = 'canela.sysmsg_custom';
const MAX = 30;
const SAVE_DELAY_MS = 600;

type Trigger = 'activated' | 'group' | 'trust_level' | 'badge' | 'first_post' | 'verified' | 'anniversary';

interface Entry {
  id: string;
  title: string;
  enabled: boolean;
  trigger: Trigger;
  value: number | null;
  delay: number;
  subject: string;
  body: string;
  createdAt: string;
}

const COMMON = ['site_name', 'username', 'name', 'base_url', 'user_url', 'user_preferences_url', 'guidelines_url'];

const EXTRA: Record<Trigger, string[]> = {
  activated: [],
  group: ['group_name', 'group_path'],
  trust_level: [],
  badge: ['badge_name'],
  first_post: ['url'],
  verified: [],
  anniversary: ['years'],
};

function readEntries(): Entry[] {
  try {
    const parsed = JSON.parse(getStr(SETTING, '[]'));

    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string') : [];
  } catch {
    return [];
  }
}

const newId = () => Math.random().toString(36).slice(2, 12);

export default class CustomMessagesEditor extends AdminComponent {
  badges: { id: number; name: string }[] | null = null;
  saveTimer: ReturnType<typeof setTimeout> | undefined;

  oninit(vnode: any) {
    super.oninit(vnode);

    loadBadges()
      .then((rows) => (this.badges = rows.map((row) => ({ id: Number(row.id), name: String(row.attributes.name || row.id) }))))
      .catch(() => (this.badges = []))
      .finally(() => m.redraw());
  }

  onremove(vnode: any) {
    super.onremove(vnode);

    // Sair no meio da pausa de digitação não pode perder o texto.
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.flush();
    }
  }

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

  triggers(): { key: Trigger; label: string }[] {
    const list: { key: Trigger; label: string }[] = [
      { key: 'activated', label: trans(`${KEY}.trigger_activated`, 'Conta ativada') },
      { key: 'group', label: trans(`${KEY}.trigger_group`, 'Entrou num grupo') },
      { key: 'trust_level', label: trans(`${KEY}.trigger_trust_level`, 'Chegou a um nível de confiança') },
      { key: 'badge', label: trans(`${KEY}.trigger_badge`, 'Ganhou um emblema') },
      { key: 'first_post', label: trans(`${KEY}.trigger_first_post`, 'Publicou a primeira postagem') },
      { key: 'anniversary', label: trans(`${KEY}.trigger_anniversary`, 'Aniversário de conta') },
    ];

    if (isExtensionEnabled('ramon-verified')) {
      list.push({ key: 'verified', label: trans(`${KEY}.trigger_verified`, 'Conta verificada (ramon/verified)') });
    }

    return list;
  }

  options(trigger: Trigger): { value: number; label: string }[] {
    if (trigger === 'group') {
      return app.store
        .all<any>('groups')
        .filter((group) => !['2', '3'].includes(String(group.id())))
        .map((group) => ({ value: Number(group.id()), label: String(group.namePlural() || group.nameSingular()) }));
    }

    if (trigger === 'trust_level') {
      return [
        { value: 1, label: trans(`${KEY}.level_1`, '1 - Básico') },
        { value: 2, label: trans(`${KEY}.level_2`, '2 - Membro') },
        { value: 3, label: trans(`${KEY}.level_3`, '3 - Regular') },
        { value: 4, label: trans(`${KEY}.level_4`, '4 - Líder') },
      ];
    }

    if (trigger === 'badge') return (this.badges || []).map((badge) => ({ value: badge.id, label: badge.name }));

    return [];
  }

  view() {
    const entries = readEntries();
    const update = (index: number, patch: Partial<Entry>, debounce = false) =>
      this.write(
        entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
        debounce
      );
    const remove = (index: number) => {
      if (window.confirm(trans(`${KEY}.remove_confirm`, 'Apagar esta mensagem automática?'))) {
        this.write(entries.filter((_, i) => i !== index));
      }
    };
    const add = () =>
      this.write([
        ...entries,
        {
          id: newId(),
          title: '',
          enabled: false,
          trigger: 'activated',
          value: null,
          delay: 0,
          subject: '',
          body: '',
          createdAt: new Date().toISOString(),
        },
      ]);

    return (
      <div className="CanelaCustomMessages">
        {entries.length === 0 ? (
          <p className="helpText">{trans(`${KEY}.empty`, 'Nenhuma mensagem personalizada ainda.')}</p>
        ) : (
          <ol className="CanelaCustomMessages-list">{entries.map((entry, index) => this.entryView(entry, index, update, remove))}</ol>
        )}
        {entries.length < MAX && (
          <Button className="Button" icon="fas fa-plus" onclick={add}>
            {trans(`${KEY}.add`, 'Adicionar mensagem')}
          </Button>
        )}
      </div>
    );
  }

  entryView(
    entry: Entry,
    index: number,
    update: (index: number, patch: Partial<Entry>, debounce?: boolean) => void,
    remove: (index: number) => void
  ) {
    const options = this.options(entry.trigger);
    const needsValue = entry.trigger === 'group' || entry.trigger === 'trust_level' || entry.trigger === 'badge';
    const variables = [...COMMON, ...EXTRA[entry.trigger]];
    const id = `CanelaCustomMessage-${entry.id}`;

    return (
      <li key={entry.id} className={`CanelaCustomMessage${entry.enabled ? '' : ' is-off'}`}>
        <div className="CanelaCustomMessage-head">
          <AdminSwitch
            state={entry.enabled}
            label={trans(`${KEY}.enabled`, 'Ligada')}
            onchange={(value: boolean) => update(index, { enabled: value })}
          />
          <input
            className="FormControl CanelaCustomMessage-title"
            type="text"
            maxlength={100}
            value={entry.title}
            aria-label={trans(`${KEY}.title_label`, 'Nome da mensagem (só no admin)')}
            placeholder={trans(`${KEY}.title_label`, 'Nome da mensagem (só no admin)')}
            oninput={(e: InputEvent) => update(index, { title: (e.target as HTMLInputElement).value }, true)}
          />
          <Button
            className="Button Button--icon Button--link CanelaCustomMessage-remove"
            icon="far fa-trash-can"
            aria-label={trans(`${KEY}.remove`, 'Apagar')}
            onclick={() => remove(index)}
          />
        </div>

        <div className="CanelaCustomMessage-when">
          <label for={`${id}-trigger`}>{trans(`${KEY}.when`, 'Quando')}</label>
          <select
            id={`${id}-trigger`}
            className="FormControl"
            value={entry.trigger}
            onchange={(e: Event) => {
              const trigger = (e.target as HTMLSelectElement).value as Trigger;
              update(index, { trigger, value: trigger === 'anniversary' ? 1 : null, delay: 0 });
            }}
          >
            {this.triggers().map((trigger) => (
              <option value={trigger.key}>{trigger.label}</option>
            ))}
          </select>

          {needsValue && (
            <select
              className="FormControl"
              value={entry.value ?? ''}
              aria-label={trans(`${KEY}.which`, 'Qual')}
              onchange={(e: Event) => update(index, { value: Number((e.target as HTMLSelectElement).value) || null })}
            >
              <option value="">{trans(`${KEY}.choose`, 'Escolha…')}</option>
              {/* `selected` em cada opção: os emblemas chegam depois do primeiro
                  desenho, e o `value` do select não seria reaplicado. */}
              {options.map((option) => (
                <option value={option.value} selected={option.value === entry.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          {entry.trigger === 'anniversary' && (
            <span className="CanelaCustomMessage-delay">
              <input
                className="FormControl"
                type="number"
                min={1}
                max={50}
                value={entry.value ?? ''}
                aria-label={trans(`${KEY}.years_label`, 'Anos de conta')}
                oninput={(e: InputEvent) =>
                  update(index, { value: Math.max(1, Math.min(50, Number((e.target as HTMLInputElement).value) || 1)) }, true)
                }
              />
              <span>{trans(`${KEY}.years_suffix`, 'ano(s) de conta')}</span>
            </span>
          )}

          {entry.trigger === 'activated' && (
            <span className="CanelaCustomMessage-delay">
              <input
                className="FormControl"
                type="number"
                min={0}
                max={365}
                value={entry.delay}
                aria-label={trans(`${KEY}.delay_label`, 'Dias depois')}
                oninput={(e: InputEvent) =>
                  update(index, { delay: Math.max(0, Math.min(365, Number((e.target as HTMLInputElement).value) || 0)) }, true)
                }
              />
              <span>{trans(`${KEY}.delay_suffix`, 'dias depois (0 = na hora)')}</span>
            </span>
          )}
        </div>

        {entry.trigger === 'anniversary' && (
          <p className="helpText">
            {trans(
              `${KEY}.anniversary_help`,
              'Sai pelo agendador do Flarum no dia do aniversário de cadastro, só para aniversários depois de a mensagem ser criada.'
            )}
          </p>
        )}

        {entry.trigger === 'activated' && entry.delay > 0 && (
          <p className="helpText">
            {trans(
              `${KEY}.delay_help`,
              'Sai pelo agendador do Flarum (php flarum schedule:run no cron), e só para quem se cadastrar depois de a mensagem ser criada.'
            )}
          </p>
        )}

        <div className="Form-group">
          <label className="CanelaAdmin-label" for={`${id}-subject`}>
            {trans(`${FIELDS}.subject`, 'Assunto')}
          </label>
          <input
            id={`${id}-subject`}
            className="FormControl"
            type="text"
            maxlength={200}
            value={entry.subject}
            oninput={(e: InputEvent) => update(index, { subject: (e.target as HTMLInputElement).value }, true)}
          />
        </div>

        <div className="Form-group">
          <label className="CanelaAdmin-label" for={`${id}-body`}>
            {trans(`${FIELDS}.body`, 'Texto')}
          </label>
          <textarea
            id={`${id}-body`}
            className="FormControl CanelaAdmin-textarea"
            rows={6}
            value={entry.body}
            oninput={(e: InputEvent) => update(index, { body: (e.target as HTMLTextAreaElement).value }, true)}
          />
        </div>

        <p className="helpText CanelaSystemAdmin-variables">
          {trans(`${FIELDS}.variables`, 'Variáveis: {list}', { list: '' }).trim()}{' '}
          {variables.map((name) => (
            <code>{`%{${name}}`}</code>
          ))}
        </p>
      </li>
    );
  }
}
