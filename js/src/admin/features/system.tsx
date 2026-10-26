/*
 * A aba "Mensagens automáticas": o usuário do sistema (`system`) e
 * um card por mensagem automática, com o liga/desliga no cabeçalho e o assunto e o texto
 * editáveis. Vazios, valem os textos padrão, no idioma de quem recebe.
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';
import Avatar from 'flarum/common/components/Avatar';

import { AdminComponent, getStr, saveSetting, trans } from '../util';
import { AdminNotice } from '../components/AdminCard';
import type { CardDef } from '../types';
import { AdminTextField } from './community';
import CustomMessagesEditor from './systemCustom';

const KEY = 'ramon-canela.admin.system_user';
const MSG = 'ramon-canela.admin.sysmsg';
const SETTING = 'canela.system_user_id';

interface SystemUserData {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  slug: string;
}

/**
 * O texto padrão cru, com as variáveis `%{nome}` intactas: o `trans` do
 * Flarum trataria `{nome}` como parâmetro dele e trocaria por "undefined".
 */
const rawText = (key: string, fallback: string): string => {
  const value = (app.translator.translations as Record<string, unknown>)[key];

  return typeof value === 'string' && value !== '' ? value : fallback;
};

const systemUser = (): SystemUserData | null => (app.forum.attribute('canelaSystemUser') as SystemUserData | null) || null;

/** Sem o usuário do sistema, os cards das mensagens ficam trancados. */
const needsUser = (): string | null => (systemUser() ? null : trans(`${KEY}.needs_user`));

class SystemUserCard extends AdminComponent {
  loading = false;

  view() {
    const user = systemUser();

    if (!user) {
      return (
        <div className="CanelaSystemAdmin">
          <p className="helpText">{trans(`${KEY}.missing`)}</p>
          <Button className="Button Button--primary" icon="fas fa-robot" loading={this.loading} onclick={() => this.create()}>
            {trans(`${KEY}.create`)}
          </Button>
        </div>
      );
    }

    const profile = `${app.forum.attribute('baseUrl')}/u/${user.slug}`;
    const avatarUser = { avatarUrl: () => user.avatarUrl, displayName: () => user.displayName, username: () => user.username, color: () => '' };

    return (
      <div className="CanelaSystemAdmin">
        <div className="CanelaSystemAdmin-user">
          <Avatar user={avatarUser as any} />
          <strong>{trans(`${KEY}.created_as`, { name: user.displayName })}</strong>
        </div>
        <p className="helpText">{trans(`${KEY}.profile_hint`)}</p>
        <div className="CanelaSystemAdmin-actions">
          <a className="Button" href={profile} target="_blank" rel="noopener">
            {trans(`${KEY}.open_profile`)}
          </a>
          <Button className="Button Button--danger" onclick={() => this.unlink()}>
            {trans(`${KEY}.unlink`)}
          </Button>
        </div>
      </div>
    );
  }

  create(): void {
    this.loading = true;

    app
      .request<{ data: SystemUserData }>({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/canela/system-user` })
      .then((response) => {
        app.forum.pushAttributes({ canelaSystemUser: response.data });
        app.data.settings[SETTING] = String(response.data.id);
      })
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  unlink(): void {
    const question = trans(`${KEY}.unlink_confirm`);

    if (!window.confirm(question)) return;

    app.data.settings[SETTING] = '';
    app.forum.pushAttributes({ canelaSystemUser: null });
    saveSetting({ [SETTING]: '' });
    m.redraw();
  }
}

/** Os botões "Editar a partir do padrão" e "Voltar ao padrão" de um campo. */
class DefaultTextButtons extends AdminComponent {
  view() {
    const { settingKey, fallback } = this.attrs;
    const custom = getStr(settingKey) !== '';
    const set = (value: string) => {
      app.data.settings[settingKey] = value;
      saveSetting({ [settingKey]: value });
      m.redraw();
    };

    return (
      <div className="CanelaSystemAdmin-actions">
        {custom ? (
          <Button className="Button Button--text" icon="fas fa-rotate-left" onclick={() => set('')}>
            {trans(`${MSG}.fields.restore_default`)}
          </Button>
        ) : (
          <Button className="Button Button--text" icon="fas fa-pen" onclick={() => set(fallback)}>
            {trans(`${MSG}.fields.use_default`)}
          </Button>
        )}
      </div>
    );
  }
}

const COMMON_VARIABLES = ['site_name', 'username', 'name', 'base_url', 'user_url', 'user_preferences_url', 'guidelines_url'];

interface MessageDef {
  type: string;
  icon: string;
  subject: string;
  body: string;
  variables?: string[];
  extensions?: string[];
  dependsOn?: string;
  keywords: string;
}

// Os textos em português aqui são só o reserva do `trans` (o padrão de
// verdade sai das traduções, no idioma de quem recebe a mensagem).
const MESSAGES: MessageDef[] = [
  {
    type: 'welcome_user',
    icon: 'fas fa-hand',
    subject: 'Boas-vindas ao %{site_name}!',
    body: 'Obrigado por entrar no %{site_name}, e seja bem-vindo(a)!',
    keywords: 'boas-vindas welcome bem-vindo cadastro registro novo usuário send_welcome_message',
  },
  {
    type: 'welcome_invite',
    icon: 'fas fa-envelope-open-text',
    subject: 'Boas-vindas ao %{site_name}!',
    body: 'Obrigado por aceitar o convite para o %{site_name}, e seja bem-vindo(a)!',
    dependsOn: 'canela.invites_enabled',
    keywords: 'convite invite boas-vindas welcome',
  },
  {
    type: 'welcome_tl1_user',
    icon: 'fas fa-seedling',
    subject: 'Obrigado por passar um tempo com a gente',
    body: 'Oi! Vimos que você tem lido bastante, o que é ótimo, então subimos você um nível de confiança!',
    dependsOn: 'canela.trust_levels_enabled',
    keywords: 'nível confiança trust level tl1 básico promoção send_tl1_welcome_message',
  },
  {
    type: 'tl2_promotion_message',
    icon: 'fas fa-medal',
    subject: 'Parabéns pela promoção de nível de confiança!',
    body: 'Subimos você mais um nível de confiança!',
    dependsOn: 'canela.trust_levels_enabled',
    keywords: 'nível confiança trust level tl2 membro promoção send_tl2_promotion_message',
  },
  {
    type: 'welcome_staff',
    icon: 'fas fa-shield-halved',
    subject: 'Parabéns, você agora faz parte da equipe (%{role})!',
    body: 'Você recebeu o papel de %{role} de outro membro da equipe.',
    variables: ['role'],
    keywords: 'equipe staff admin moderador moderator grupo',
  },
  {
    type: 'user_added_to_group_as_member',
    icon: 'fas fa-user-group',
    subject: 'Você entrou no grupo %{group_name}',
    body: 'Você foi adicionado(a) como membro do grupo %{group_name}.',
    variables: ['group_name', 'group_path'],
    keywords: 'grupo group membro member adicionado',
  },
  {
    type: 'flags_agreed_and_post_deleted',
    icon: 'fas fa-flag',
    subject: 'Post denunciado removido pela equipe',
    body: 'Esta é uma mensagem automática do %{site_name} para avisar que o seu post foi removido.',
    variables: ['url', 'flag_reason', 'flagged_post_raw_content'],
    extensions: ['flarum-flags'],
    keywords: 'denúncia denúncias flag flags post removido oculto apagado moderação',
  },
  {
    type: 'silenced_by_staff',
    icon: 'fas fa-ban',
    subject: 'Conta suspensa',
    body: 'Esta é uma mensagem automática do %{site_name} para avisar que a sua conta foi suspensa até %{suspended_till}.',
    variables: ['suspended_till', 'reason'],
    extensions: ['flarum-suspend'],
    keywords: 'suspensão suspenso suspend silenciado silenced banido moderação',
  },
  {
    type: 'unsilenced',
    icon: 'far fa-circle-check',
    subject: 'Sua conta não está mais suspensa',
    body: 'Esta é uma mensagem automática do %{site_name} para avisar que a sua conta não está mais suspensa.',
    extensions: ['flarum-suspend'],
    keywords: 'suspensão encerrada unsuspend unsilenced liberado moderação',
  },
];

const messageCard = (def: MessageDef): CardDef => {
  const base = `${MSG}.${def.type}`;
  const subjectKey = `canela.sysmsg_${def.type}_subject`;
  const bodyKey = `canela.sysmsg_${def.type}_body`;
  const subjectDefault = () => rawText(`${base}.subject`, def.subject);
  const bodyDefault = () => rawText(`${base}.body`, def.body);
  const variables = [...COMMON_VARIABLES, ...(def.variables || [])];

  return {
    id: `sysmsg-${def.type}`,
    group: 'system',
    icon: def.icon,
    title: () => trans(`${base}.title`),
    description: () => trans(`${base}.help`),
    keywords: `mensagem automática automated message sistema system ${def.type} ${def.keywords}`,
    master: `canela.sysmsg_${def.type}`,
    extensions: ['flarum-messages', ...(def.extensions || [])],
    dependsOn: def.dependsOn,
    lockedBy: needsUser,
    body: () => (
      <>
        <AdminTextField settingKey={subjectKey} label={trans(`${MSG}.fields.subject`)} placeholder={subjectDefault()} />
        <DefaultTextButtons settingKey={subjectKey} fallback={subjectDefault()} />
        <AdminTextField
          settingKey={bodyKey}
          multiline
          label={trans(`${MSG}.fields.body`)}
          placeholder={bodyDefault()}
          help={trans(`${MSG}.fields.default_hint`)}
        />
        <DefaultTextButtons settingKey={bodyKey} fallback={bodyDefault()} />
        <p className="helpText CanelaSystemAdmin-variables">
          {trans(`${MSG}.fields.variables`, { list: '' }).trim()}{' '}
          {variables.map((name) => (
            <code>{`%{${name}}`}</code>
          ))}
        </p>
      </>
    ),
  };
};

const cards: CardDef[] = [
  {
    id: 'system-user',
    group: 'system',
    icon: 'fas fa-robot',
    title: () => trans(`${KEY}.title`),
    description: () => trans(`${KEY}.help`),
    keywords: 'usuário do sistema system user bot remetente notificações login',
    body: () => (
      <>
        <SystemUserCard />
        <AdminNotice icon="far fa-envelope">{trans(`${KEY}.messages_notice`)}</AdminNotice>
        <AdminNotice icon="fas fa-reply">{trans(`${KEY}.no_replies_notice`)}</AdminNotice>
      </>
    ),
  },
  ...MESSAGES.map(messageCard),
  {
    id: 'sysmsg-custom',
    group: 'system',
    icon: 'fas fa-wand-magic-sparkles',
    title: () => trans(`${MSG}.custom.title`),
    description: () => trans(`${MSG}.custom.help`),
    keywords: 'mensagem personalizada custom automática gatilho trigger aniversário anniversary verificada emblema grupo nível dias',
    extensions: ['flarum-messages'],
    lockedBy: needsUser,
    body: () => <CustomMessagesEditor />,
  },
];

export default cards;
