/*
 * Cards da IA: provedor e modelos, recursos, personas,
 * acesso e limites, e embeddings — tudo no grupo "IA".
 *
 * As chaves de API são guardadas como qualquer configuração, mas só o PHP as
 * lê: o fórum nunca as recebe. O campo é de senha e mostra só se há uma
 * chave gravada, para ela não aparecer na tela de quem olha por cima do ombro.
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';

import { AdminNotice, AdminSubGroup, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminSelect from '../components/AdminSelect';
import AdminNumber from '../components/AdminNumber';
import { AdminComponent, getBool, getStr, saveSetting, trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.ai';
const SAVE_DELAY_MS = 600;

const ANTHROPIC_MODELS: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-haiku-5-5': 'Claude Haiku 5.5',
};

const toggle = (name: string, label: string, help: string, dependsOn?: string) => (
  <AdminToggle
    settingKey={`canela.ai_${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, help)}
    dependsOn={dependsOn}
  />
);

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

const AI = 'canela.ai_enabled';

const provider = (): string => (getStr('canela.ai_provider', 'anthropic') === 'openai' ? 'openai' : 'anthropic');

/** O provedor tem o que precisa para responder (o mesmo teste do PHP). */
const configured = (): boolean =>
  provider() === 'anthropic'
    ? getStr('canela.ai_anthropic_key') !== ''
    : getStr('canela.ai_openai_base_url') !== '' && getStr('canela.ai_openai_model') !== '';

const requiresProvider = (): string | null =>
  configured() ? null : trans(`${KEY}.requires_provider`, 'Configure o provedor e a chave no card "Provedor e modelos" antes.');

// ─────────────────────────────────────────────────────────────────────────────
// Controles próprios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Texto de uma linha que salva sozinho depois de uma pausa. `secret` vira um
 * campo de senha que não mostra o valor gravado — só diz que existe —, e
 * gravar vazio apaga a chave.
 */
class AiText extends AdminComponent {
  draft: string | null = null;
  timer: ReturnType<typeof setTimeout> | undefined;

  view() {
    const { settingKey, label, help, placeholder, secret } = this.attrs;
    const stored = getStr(settingKey);
    const id = `CanelaAdmin-${String(settingKey).replace(/\W+/g, '-')}`;

    return (
      <div className="Form-group CanelaAiAdmin-text">
        <label className="CanelaAdmin-label" for={id}>
          {label}
        </label>
        <input
          id={id}
          className="FormControl"
          type={secret ? 'password' : 'text'}
          autocomplete={secret ? 'new-password' : 'off'}
          spellcheck={false}
          placeholder={secret && stored ? trans(`${KEY}.key_saved`, '•••••••• (chave gravada; digite para trocar)') : placeholder}
          value={this.draft ?? (secret ? '' : stored)}
          oninput={(event: InputEvent) => this.store((event.target as HTMLInputElement).value)}
          onblur={() => this.flush()}
        />
        {secret && stored && (
          <button type="button" className="Button Button--link CanelaAiAdmin-clearKey" onclick={() => this.save('')}>
            {trans(`${KEY}.key_clear`, 'Apagar a chave gravada')}
          </button>
        )}
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }

  store(value: string): void {
    this.draft = value;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  flush(): void {
    clearTimeout(this.timer);

    if (this.draft === null) return;

    const value = this.draft.trim();
    this.draft = null;

    // Campo de chave deixado vazio não apaga a chave: isso é o botão.
    if (this.attrs.secret && value === '') return;

    this.save(value);
  }

  save(value: string): void {
    app.data.settings[this.attrs.settingKey] = value;
    saveSetting({ [this.attrs.settingKey]: value });
    m.redraw();
  }

  onremove(vnode: any) {
    super.onremove(vnode);
    this.flush();
  }
}

/** Os grupos que podem usar um recurso: caixas de seleção que gravam a lista de ids. */
class AiGroups extends AdminComponent {
  view() {
    const { settingKey, label, help } = this.attrs;
    const selected = getStr(settingKey)
      .split(/[\s,]+/)
      .filter(Boolean);
    // Visitantes (2) ficam de fora: conversas e pedidos são de alguém.
    const groups = app.store.all<any>('groups').filter((group) => group.id() !== '2');

    return (
      <div className="Form-group CanelaAiAdmin-groups">
        <label className="CanelaAdmin-label">{label}</label>
        <div className="CanelaAiAdmin-groupList">
          {groups.map((group) => (
            <Switch
              state={selected.includes(group.id())}
              onchange={(checked: boolean) => {
                const next = checked ? [...selected, group.id()] : selected.filter((id) => id !== group.id());
                const value = Array.from(new Set(next)).join(',');

                app.data.settings[settingKey] = value;
                saveSetting({ [settingKey]: value });
              }}
            >
              {group.icon() && <Icon name={group.icon()} />} {group.namePlural()}
            </Switch>
          ))}
        </div>
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }
}

/**
 * Os idiomas alvo da tradução: os instalados no fórum, cada um com a chave.
 * Nenhum marcado (o padrão) = todos os instalados, inclusive os que vierem
 * depois — por isso desmarcar o último volta a "todos".
 */
class AiLocales extends AdminComponent {
  view() {
    const { settingKey, label, help } = this.attrs;
    const installed: Record<string, string> = (app.data as any).locales || {};
    const selected = getStr(settingKey)
      .split(/[\s,]+/)
      .filter((code) => code && code in installed);
    const all = selected.length === 0;

    return (
      <div className="Form-group CanelaAiAdmin-groups">
        <label className="CanelaAdmin-label">{label}</label>
        <div className="CanelaAiAdmin-groupList">
          {Object.keys(installed).map((code) => (
            <Switch
              state={all || selected.includes(code)}
              onchange={(checked: boolean) => {
                const base = all ? Object.keys(installed) : selected;
                const next = checked ? [...base, code] : base.filter((item) => item !== code);
                const value = next.length === Object.keys(installed).length ? '' : Array.from(new Set(next)).join(',');

                app.data.settings[settingKey] = value;
                saveSetting({ [settingKey]: value });
              }}
            >
              {installed[code]} <code>{code}</code>
            </Switch>
          ))}
        </div>
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }
}

interface TestResult {
  target: string;
  ok: boolean;
  message: string;
  ms: number;
}

/** "Testar conexão": um pedido mínimo a cada modelo, com a resposta crua do provedor. */
class AiTestButton extends AdminComponent {
  loading = false;
  results: TestResult[] | null = null;

  view() {
    return (
      <div className="CanelaAiAdmin-test">
        <Button className="Button" icon="fas fa-plug" loading={this.loading} onclick={() => this.run()}>
          {trans(`${KEY}.test_button`, 'Testar conexão')}
        </Button>
        {this.results && (
          <ul className="CanelaAiAdmin-testResults">
            {this.results.map((result) => (
              <li className={result.ok ? 'is-ok' : 'is-error'}>
                <Icon name={result.ok ? 'fas fa-circle-check' : 'fas fa-circle-xmark'} />
                <code>{result.target || '-'}</code>
                <span>{result.message}</span>
                {/* eslint-disable-next-line i18n/no-hardcoded-text -- unidade (milissegundos), igual em todo idioma */}
                <span className="CanelaAiAdmin-testMs">{result.ms} ms</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  run(): void {
    this.loading = true;
    this.results = null;

    app
      .request<{ data: TestResult[] }>({
        method: 'POST',
        url: `${app.forum.attribute('apiUrl')}/canela/ai/test`,
        body: { target: this.attrs.target || 'llm' },
      })
      .then((response) => (this.results = response.data))
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }
}

interface Persona {
  id: string;
  name: string;
  description: string;
  prompt: string;
  search: boolean;
  read: boolean;
  web: boolean;
  enabled: boolean;
}

/**
 * O editor de personas (os "agentes" da IA). Parte das padrões quando
 * a configuração está vazia; qualquer mudança grava a lista inteira, em JSON.
 * "Restaurar as padrões" apaga a configuração.
 */
class PersonasEditor extends AdminComponent {
  timer: ReturnType<typeof setTimeout> | undefined;
  list: Persona[] = [];

  oninit(vnode: any) {
    super.oninit(vnode);
    this.list = this.load();
  }

  load(): Persona[] {
    try {
      const stored = JSON.parse(getStr('canela.ai_personas') || '[]');

      if (Array.isArray(stored) && stored.length) return stored;
    } catch {
      // JSON quebrado: volta às padrões.
    }

    return JSON.parse(JSON.stringify(app.forum.attribute<Persona[]>('canelaAiDefaultPersonas') || []));
  }

  view() {
    const field = (persona: Persona, name: keyof Persona, label: string, multiline = false) => (
      <div className="Form-group">
        <label className="CanelaAdmin-label">{label}</label>
        {multiline ? (
          <textarea
            className="FormControl"
            rows={6}
            value={String(persona[name] ?? '')}
            oninput={(event: InputEvent) => this.change(persona, name, (event.target as HTMLTextAreaElement).value)}
          />
        ) : (
          <input
            className="FormControl"
            type="text"
            value={String(persona[name] ?? '')}
            oninput={(event: InputEvent) => this.change(persona, name, (event.target as HTMLInputElement).value)}
          />
        )}
      </div>
    );

    const flag = (persona: Persona, name: keyof Persona, label: string) => (
      <Switch state={!!persona[name]} onchange={(checked: boolean) => this.change(persona, name, checked)}>
        {label}
      </Switch>
    );

    return (
      <div className="CanelaAiAdmin-personas">
        {this.list.map((persona, index) => (
          <details className="CanelaAiAdmin-persona" open={index === 0 && this.list.length === 1}>
            <summary>
              <Icon name={persona.enabled ? 'fas fa-robot' : 'fas fa-power-off'} /> <strong>{persona.name || persona.id}</strong>
              <span className="CanelaAiAdmin-personaId">{persona.id}</span>
              {!persona.enabled && <span className="CanelaAiAdmin-off">{trans(`${KEY}.persona_off`, 'desligada')}</span>}
            </summary>
            <div className="CanelaAiAdmin-personaBody">
              {field(persona, 'name', trans(`${KEY}.persona_name`, 'Nome'))}
              {field(persona, 'id', trans(`${KEY}.persona_id`, 'Identificador (letras, números, _ e -)'))}
              {field(persona, 'description', trans(`${KEY}.persona_description`, 'Descrição (aparece no seletor)'))}
              {field(persona, 'prompt', trans(`${KEY}.persona_prompt`, 'Prompt de sistema'), true)}
              <div className="CanelaAiAdmin-flags">
                {flag(persona, 'enabled', trans(`${KEY}.persona_enabled`, 'Ligada'))}
                {flag(persona, 'search', trans(`${KEY}.persona_search`, 'Pode buscar no fórum'))}
                {flag(persona, 'read', trans(`${KEY}.persona_read`, 'Pode ler discussões'))}
                {flag(persona, 'web', trans(`${KEY}.persona_web`, 'Pode pesquisar na web (só Anthropic; cobrado por busca)'))}
              </div>
              <Button className="Button Button--danger" icon="far fa-trash-can" disabled={this.list.length < 2} onclick={() => this.remove(persona)}>
                {trans(`${KEY}.persona_remove`, 'Remover persona')}
              </Button>
            </div>
          </details>
        ))}
        <div className="CanelaAdmin-actions">
          <Button className="Button" icon="fas fa-plus" onclick={() => this.add()}>
            {trans(`${KEY}.persona_add`, 'Nova persona')}
          </Button>
          <Button className="Button Button--link" icon="fas fa-rotate-left" onclick={() => this.restore()}>
            {trans(`${KEY}.persona_restore`, 'Restaurar as padrões')}
          </Button>
        </div>
        <AdminSelect
          settingKey="canela.ai_default_persona"
          label={trans(`${KEY}.default_persona_label`, 'Persona padrão')}
          help={trans(`${KEY}.default_persona_help`, 'A que vem escolhida na "Nova pergunta" e no "Perguntar à IA" da busca.')}
          options={Object.fromEntries(this.list.filter((persona) => persona.enabled).map((persona) => [persona.id, persona.name]))}
        />
      </div>
    );
  }

  change(persona: Persona, name: keyof Persona, value: any): void {
    (persona as any)[name] =
      name === 'id'
        ? String(value)
            .replace(/[^a-z0-9_-]/gi, '')
            .toLowerCase()
        : value;
    this.save();
  }

  add(): void {
    this.list.push({
      id: `persona_${this.list.length + 1}`,
      name: trans(`${KEY}.persona_new_name`, 'Nova persona'),
      description: '',
      prompt: '',
      search: true,
      read: true,
      web: false,
      enabled: true,
    });
    this.save();
  }

  remove(persona: Persona): void {
    this.list = this.list.filter((item) => item !== persona);
    this.save();
  }

  restore(): void {
    app.data.settings['canela.ai_personas'] = '';
    saveSetting({ 'canela.ai_personas': '' });
    this.list = this.load();
  }

  save(): void {
    const value = JSON.stringify(this.list);

    app.data.settings['canela.ai_personas'] = value;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => saveSetting({ 'canela.ai_personas': value }), SAVE_DELAY_MS);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────────────────────────────────────

const statusNotice = (): Mithril.Children => {
  if (!app.forum.attribute<boolean>('canelaAiSchemaReady')) {
    return (
      <AdminNotice icon="fas fa-database">
        {trans(`${KEY}.schema_missing`, 'As tabelas da IA ainda não foram criadas: rode "php flarum migrate". Até lá os recursos ficam escondidos.')}
      </AdminNotice>
    );
  }

  if (!configured()) {
    return (
      <AdminNotice icon="fas fa-key">
        {trans(
          `${KEY}.not_configured`,
          'Sem chave de API configurada, os recursos de IA ficam escondidos no fórum. Configure o provedor abaixo e use "Testar conexão".'
        )}
      </AdminNotice>
    );
  }

  return null;
};

const cards: CardDef[] = [
  {
    id: 'ai-provider',
    group: 'ai',
    icon: 'fas fa-plug',
    title: () => trans(`${KEY}.provider_title`, 'Provedor e modelos'),
    description: help('enabled', 'Desligada, nenhum recurso de IA aparece no fórum e a API da IA responde 404.'),
    keywords: 'ia ai provedor provider anthropic claude openai chave key api modelo model sonnet opus haiku testar test conexão connection llm',
    master: AI,
    body: () => (
      <>
        {statusNotice()}
        <AdminSelect
          settingKey="canela.ai_provider"
          label={trans(`${KEY}.provider_label`, 'Provedor')}
          help={trans(
            `${KEY}.provider_help`,
            'A Anthropic (Claude) é o padrão. "Compatível com OpenAI" serve para a OpenAI e para qualquer serviço com a mesma API (OpenRouter, Groq, Mistral, DeepSeek, Ollama, LM Studio…).'
          )}
          options={{
            anthropic: trans(`${KEY}.provider_anthropic`, 'Anthropic (Claude)'),
            openai: trans(`${KEY}.provider_openai`, 'Compatível com OpenAI'),
          }}
          default="anthropic"
        />
        {provider() === 'anthropic' ? (
          <AdminSubGroup>
            <AiText
              settingKey="canela.ai_anthropic_key"
              secret
              label={trans(`${KEY}.anthropic_key_label`, 'Chave da API da Anthropic')}
              help={trans(`${KEY}.anthropic_key_help`, 'Crie em console.anthropic.com → API Keys. Fica só no servidor; o fórum nunca a recebe.')}
              placeholder="sk-ant-…"
            />
            <AdminSelect
              settingKey="canela.ai_anthropic_model"
              label={trans(`${KEY}.model_label`, 'Modelo principal')}
              help={trans(
                `${KEY}.anthropic_model_help`,
                'Usado no bot, nos resumos e nos modos do ajudante que reescrevem (explicar, prompt personalizado). O Sonnet equilibra qualidade e custo; o Opus é o mais capaz.'
              )}
              options={ANTHROPIC_MODELS}
              default="claude-sonnet-5-5"
            />
            <AdminSelect
              settingKey="canela.ai_anthropic_fast_model"
              label={trans(`${KEY}.fast_model_label`, 'Modelo rápido')}
              help={trans(
                `${KEY}.fast_model_help`,
                'Para as tarefas curtas: títulos das conversas, revisão, tradução, sugestão de título e de tags, resumos curtos da lista.'
              )}
              options={ANTHROPIC_MODELS}
              default="claude-haiku-5-5"
            />
          </AdminSubGroup>
        ) : (
          <AdminSubGroup>
            <AiText
              settingKey="canela.ai_openai_base_url"
              label={trans(`${KEY}.openai_url_label`, 'URL base da API')}
              help={trans(
                `${KEY}.openai_url_help`,
                'O endereço até o /v1; o tema acrescenta /chat/completions. Ex.: https://api.openai.com/v1, https://openrouter.ai/api/v1, http://localhost:11434/v1.'
              )}
              placeholder="https://api.openai.com/v1"
            />
            <AiText
              settingKey="canela.ai_openai_key"
              secret
              label={trans(`${KEY}.openai_key_label`, 'Chave da API')}
              help={trans(`${KEY}.openai_key_help`, 'Enviada como "Authorization: Bearer". Um servidor local pode dispensar a chave.')}
            />
            <AiText settingKey="canela.ai_openai_model" label={trans(`${KEY}.model_label`, 'Modelo principal')} placeholder="gpt-…" />
            <AiText
              settingKey="canela.ai_openai_fast_model"
              label={trans(`${KEY}.fast_model_label`, 'Modelo rápido')}
              help={trans(`${KEY}.openai_fast_help`, 'Vazio usa o principal.')}
            />
          </AdminSubGroup>
        )}
        <AiTestButton target="llm" />
      </>
    ),
  },
  {
    id: 'ai-bot',
    group: 'ai',
    icon: 'fas fa-robot',
    title: () => trans(`${KEY}.bot_enabled_label`, 'Bot de IA (conversas)'),
    description: help(
      'bot_enabled',
      'A página /ai/conversations: perguntas à IA, com a lista de conversas na barra lateral, personas e respostas em streaming. Com as personas que podem, a IA busca e lê o fórum (só o que a pessoa pode ver) e cita as discussões.'
    ),
    keywords: 'ia ai bot conversas conversations perguntar ask chat robô robot busca search cabeçalho header',
    master: 'canela.ai_bot_enabled',
    dependsOn: AI,
    lockedBy: requiresProvider,
    body: () => (
      <>
        {toggle('bot_header_icon', 'Ícone do robô no cabeçalho', 'Abre as conversas; dentro delas, volta para onde a pessoa estava.')}
        {toggle('bot_sidebar_link', 'Link "Bot de IA" na barra lateral', 'Na seção da comunidade.', 'canela.sidebar_enabled')}
        {toggle(
          'search_enabled',
          'Perguntar à IA na busca',
          'O campo de busca vira "Pesquisar ou perguntar à IA", e o modal de busca oferece "Perguntar à IA: <consulta>", que abre a conversa.'
        )}
      </>
    ),
  },
  {
    id: 'ai-personas',
    group: 'ai',
    icon: 'fas fa-masks-theater',
    title: () => trans(`${KEY}.personas_title`, 'Personas'),
    description: () =>
      trans(
        `${KEY}.personas_help`,
        'Cada persona tem nome, descrição, o prompt de sistema e as ferramentas que pode usar. Quem conversa escolhe a persona embaixo do campo de pergunta.'
      ),
    keywords: 'ia ai persona personas agente agent prompt sistema system ajudante criativa pesquisador researcher',
    dependsOn: 'canela.ai_bot_enabled',
    body: () => <PersonasEditor />,
  },
  {
    id: 'ai-helper',
    group: 'ai',
    icon: 'fas fa-wand-magic-sparkles',
    title: () => trans(`${KEY}.helper_enabled_label`, 'Ajudante de IA no editor'),
    description: help(
      'helper_enabled',
      'O botão ✨ da barra do editor: revisar, traduzir, simplificar, explicar, gerar tabela, prompt personalizado, sugerir título e sugerir tags, com a prévia das mudanças e "Confirmar/Descartar".'
    ),
    keywords: 'ia ai ajudante helper editor composer revisar traduzir simplificar explicar tabela título etiquetas',
    master: 'canela.ai_helper_enabled',
    dependsOn: AI,
    lockedBy: requiresProvider,
  },
  {
    id: 'ai-summary',
    group: 'ai',
    icon: 'fas fa-align-left',
    title: () => trans(`${KEY}.summary_enabled_label`, 'Resumo da discussão'),
    description: help(
      'summary_enabled',
      'O botão "Resumir" no mapa da discussão abre o painel com o resumo em streaming. O resumo fica guardado, e todos que veem a discussão podem lê-lo; quando a discussão ganha respostas, ele aparece como desatualizado, com "Gerar novamente".'
    ),
    keywords: 'ia ai resumo summary resumir tópico topic mapa map',
    master: 'canela.ai_summary_enabled',
    dependsOn: AI,
    lockedBy: requiresProvider,
    body: () => (
      <AdminNumber
        settingKey="canela.ai_summary_min_posts"
        min={1}
        max={1000}
        fallback={3}
        label={trans(`${KEY}.summary_min_posts_label`, 'Mínimo de postagens para resumir')}
        help={trans(`${KEY}.summary_min_posts_help`, 'Discussões menores não mostram o botão.')}
      />
    ),
  },
  {
    id: 'ai-gists',
    group: 'ai',
    icon: 'fas fa-quote-left',
    title: () => trans(`${KEY}.gists_enabled_label`, 'Resumos curtos na lista'),
    description: help(
      'gists_enabled',
      'Uma frase gerada pela IA no lugar do excerto, nas discussões mais ativas. Gerados de hora em hora pelo agendador ("php flarum schedule:run" no cron), até 20 por rodada, cada um é uma chamada ao modelo rápido.'
    ),
    keywords: 'ia ai gist gists resumo curto lista list excerto excerpt',
    master: 'canela.ai_gists_enabled',
    dependsOn: AI,
    lockedBy: requiresProvider,
  },
  {
    id: 'ai-related',
    group: 'ai',
    icon: 'fas fa-diagram-project',
    title: () => trans(`${KEY}.related_enabled_label`, 'Discussões relacionadas (embeddings)'),
    description: help(
      'related_enabled',
      'No fim da discussão, as discussões mais parecidas no significado. Precisa da API de embeddings (abaixo); os vetores são gerados de hora em hora e na primeira visita a cada discussão.'
    ),
    keywords: 'ia ai embeddings vetores vectors relacionados related semântica semantic openai voyage',
    master: 'canela.ai_related_enabled',
    dependsOn: AI,
    lockedBy: requiresProvider,
    body: () => (
      <>
        <p className="helpText CanelaAdmin-intro">
          {trans(
            `${KEY}.embeddings_help`,
            'A Anthropic não tem API de embeddings: use uma compatível com a da OpenAI (OpenAI, Voyage, Mistral, Ollama…). Para gerar todos de uma vez: "php flarum canela:ai-embeddings --all".'
          )}
        </p>
        <AiText
          settingKey="canela.ai_embeddings_url"
          label={trans(`${KEY}.embeddings_url_label`, 'URL da API de embeddings')}
          placeholder="https://api.openai.com/v1/embeddings"
        />
        <AiText settingKey="canela.ai_embeddings_key" secret label={trans(`${KEY}.embeddings_key_label`, 'Chave da API')} />
        <AiText
          settingKey="canela.ai_embeddings_model"
          label={trans(`${KEY}.embeddings_model_label`, 'Modelo')}
          placeholder="text-embedding-3-small"
        />
        <AiTestButton target="embeddings" />
      </>
    ),
  },
  {
    id: 'ai-translation',
    group: 'ai',
    icon: 'fas fa-language',
    title: () => trans(`${KEY}.translation_enabled_label`, 'Tradução automática'),
    description: help(
      'translation_enabled',
      'Postagens e títulos escritos num idioma diferente do de quem lê são traduzidos pela IA na primeira leitura e guardados para todos. O 文A ao lado da data alterna entre a tradução e o original. Cada postagem traduzida é uma chamada ao modelo rápido.'
    ),
    keywords: 'ia ai tradução translation traduzir translate idioma language locale original localização localization',
    master: 'canela.ai_translation_enabled',
    dependsOn: AI,
    lockedBy: requiresProvider,
    body: () => (
      <>
        <AiLocales
          settingKey="canela.ai_translation_locales"
          label={trans(`${KEY}.translation_locales_label`, 'Idiomas para os quais traduzir')}
          help={trans(
            `${KEY}.translation_locales_help`,
            'O idioma de quem lê é o escolhido nas preferências (ou o do fórum, para visitantes). Quem lê num idioma desmarcado vê sempre o original.'
          )}
        />
        {toggle(
          'translation_titles',
          'Traduzir os títulos',
          'Os títulos das discussões também, na lista e na discussão, numa chamada só para a página toda.'
        )}
        {toggle(
          'translation_public_only',
          'Só conteúdo público',
          'Traduz só o que um visitante também veria. Desligado, as tags restritas também passam pelo modelo (nunca as mensagens privadas nem as postagens ocultas).'
        )}
        <AdminNumber
          settingKey="canela.ai_translation_daily_limit"
          min={0}
          max={1000000}
          fallback={500}
          label={trans(`${KEY}.translation_daily_limit_label`, 'Chamadas por dia (fórum todo)')}
          help={trans(
            `${KEY}.translation_daily_limit_help`,
            'Cada postagem traduzida, cada lote de títulos e cada lote de detecção de idioma conta uma. Esgotado, o fórum mostra o original até o dia seguinte. 0 = sem limite.'
          )}
        />
      </>
    ),
  },
  {
    id: 'ai-access',
    group: 'ai',
    icon: 'fas fa-user-shield',
    title: () => trans(`${KEY}.access_title`, 'Acesso e limites'),
    keywords: 'ia ai grupos groups permissão permission acesso access limite limit diário daily cota quota',
    dependsOn: AI,
    lockedBy: requiresProvider,
    body: () => (
      <>
        <AiGroups
          settingKey="canela.ai_allowed_groups"
          label={trans(`${KEY}.allowed_groups_label`, 'Quem pode usar o bot, o ajudante e o "Perguntar à IA"')}
          help={trans(`${KEY}.allowed_groups_help`, '"Membros" é todo usuário com o e-mail confirmado. Administradores sempre podem.')}
        />
        <AiGroups
          settingKey="canela.ai_summary_groups"
          label={trans(`${KEY}.summary_groups_label`, 'Quem pode gerar resumos de discussões')}
          help={trans(`${KEY}.summary_groups_help`, 'Ler um resumo pronto, qualquer um que veja a discussão pode, inclusive visitantes.')}
        />
        <SubDivider />
        <AdminNumber
          settingKey="canela.ai_daily_limit"
          min={0}
          max={100000}
          fallback={50}
          label={trans(`${KEY}.daily_limit_label`, 'Pedidos por pessoa por dia')}
          help={trans(
            `${KEY}.daily_limit_help`,
            'Cada pergunta ao bot, cada uso do ajudante e cada resumo gerado conta um. 0 = sem limite. Administradores não têm limite.'
          )}
        />
      </>
    ),
  },
];

export default cards;
