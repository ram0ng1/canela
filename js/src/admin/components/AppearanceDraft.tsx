/*
 * Rascunho com pré-visualização: o fundo do fórum e as páginas de entrar e
 * cadastrar (leiaute, textos e fundo). Nada é gravado ao mexer; os links
 * "Pré-visualizar" abrem o fórum numa aba com o rascunho na URL
 * (`?canelaPreview=`, lido em js/src/forum/shell/preview.ts, só para
 * administradores) e "Aplicar" grava tudo de uma vez.
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';

import { AdminComponent, getStr, saveSetting, trans } from '../util';
import BackgroundPicker, { savedBackground } from './BackgroundPicker';

const KEY = 'ramon-canela.admin.preview';
const AUTH = 'ramon-canela.admin.settings.auth';

/** O rascunho na URL: JSON em base64 (UTF-8). */
function previewUrl(path: string, state: Record<string, unknown>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let binary = '';

  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));

  const base = String(app.forum.attribute('baseUrl') || '').replace(/\/$/, '');

  return `${base}${path}?canelaPreview=${encodeURIComponent(btoa(binary))}`;
}

function openPreview(path: string, state: Record<string, unknown>): void {
  window.open(previewUrl(path, state), '_blank');
}

function actions(dirty: boolean, previews: { label: string; open: () => void }[], apply: () => void, discard: () => void) {
  return (
    <div className="CanelaDraft-actions">
      {previews.map((preview) => (
        <Button className="Button" icon="far fa-eye" onclick={preview.open}>
          {preview.label}
        </Button>
      ))}
      <span className="CanelaDraft-spacer" />
      {dirty && <span className="CanelaDraft-dirty">{trans(`${KEY}.dirty`, 'Alterações ainda não aplicadas')}</span>}
      {dirty && (
        <Button className="Button" onclick={discard}>
          {trans(`${KEY}.discard`, 'Descartar')}
        </Button>
      )}
      <Button className="Button Button--primary" disabled={!dirty} onclick={apply}>
        {trans(`${KEY}.apply`, 'Aplicar')}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Fundo do fórum
// ---------------------------------------------------------------------

export class ForumBackgroundEditor extends AdminComponent {
  draft = savedBackground('forum');

  view() {
    const saved = savedBackground('forum');

    return (
      <div className="CanelaDraft">
        <BackgroundPicker
          target="forum"
          label={this.attrs.label}
          help={this.attrs.help}
          value={this.draft}
          onchange={(value: string) => (this.draft = value)}
        />
        {actions(
          this.draft !== saved,
          [{ label: trans(`${KEY}.preview_forum`, 'Pré-visualizar'), open: () => openPreview('/', { forumBackground: this.draft }) }],
          () => {
            app.data.settings['canela.forum_background'] = this.draft;
            saveSetting({ 'canela.forum_background': this.draft });
          },
          () => (this.draft = saved)
        )}
      </div>
    );
  }
}

// ---------------------------------------------------------------------
// Páginas de entrar e cadastrar
// ---------------------------------------------------------------------

/** Chave da configuração → atributo do fórum (o mesmo nome que o rascunho usa). */
const TEXTS: Record<string, string> = {
  'canela.auth_login_title': 'canelaAuthLoginTitle',
  'canela.auth_login_subtitle': 'canelaAuthLoginSubtitle',
  'canela.auth_signup_title': 'canelaAuthSignupTitle',
  'canela.auth_signup_subtitle': 'canelaAuthSignupSubtitle',
  'canela.auth_panel_login_title': 'canelaAuthPanelLoginTitle',
  'canela.auth_panel_login_text': 'canelaAuthPanelLoginText',
  'canela.auth_panel_signup_title': 'canelaAuthPanelSignupTitle',
  'canela.auth_panel_signup_text': 'canelaAuthPanelSignupText',
};

interface AuthDraft {
  layout: string;
  background: string;
  texts: Record<string, string>;
}

function savedAuth(): AuthDraft {
  const layout = getStr('canela.auth_layout', 'card');
  const texts: Record<string, string> = {};

  Object.keys(TEXTS).forEach((key) => (texts[key] = getStr(key)));

  return {
    layout: ['card', 'discourse', 'split'].includes(layout) ? layout : 'card',
    background: savedBackground('auth'),
    texts,
  };
}

/** Um card de leiaute e fundo, outro de textos: cada um salva só a sua parte. */
type AuthSection = 'layout' | 'texts';

export class AuthPagesEditor extends AdminComponent {
  draft: AuthDraft = savedAuth();

  section(): AuthSection {
    return this.attrs.section === 'texts' ? 'texts' : 'layout';
  }

  /** A parte do outro card vem sempre do que está salvo (para a prévia e o painel da tela dividida). */
  syncOther(): void {
    const saved = savedAuth();

    if (this.section() === 'texts') {
      this.draft.layout = saved.layout;
      this.draft.background = saved.background;
    } else {
      this.draft.texts = saved.texts;
    }
  }

  dirty(): boolean {
    return JSON.stringify(this.draft) !== JSON.stringify(savedAuth());
  }

  previewState(): Record<string, unknown> {
    const texts: Record<string, string> = {};

    Object.entries(TEXTS).forEach(([key, attribute]) => (texts[attribute] = this.draft.texts[key]));

    return { layout: this.draft.layout, authBackground: this.draft.background, texts };
  }

  apply(): void {
    const payload: Record<string, string> =
      this.section() === 'texts'
        ? { ...this.draft.texts }
        : { 'canela.auth_layout': this.draft.layout, 'canela.auth_background': this.draft.background };

    Object.entries(payload).forEach(([key, value]) => (app.data.settings[key] = value));
    saveSetting(payload);
  }

  text(key: string, label: string, placeholder: string, multiline = false) {
    const id = `CanelaDraft-${key.replace(/\W+/g, '-')}`;
    const oninput = (event: InputEvent) => (this.draft.texts[key] = (event.target as HTMLInputElement).value);

    return (
      <div className="Form-group">
        <label className="CanelaAdmin-label" for={id}>
          {label}
        </label>
        {multiline ? (
          <textarea
            id={id}
            className="FormControl"
            rows={2}
            maxlength={300}
            value={this.draft.texts[key]}
            placeholder={placeholder}
            oninput={oninput}
          />
        ) : (
          <input
            id={id}
            className="FormControl"
            type="text"
            maxlength={120}
            value={this.draft.texts[key]}
            placeholder={placeholder}
            oninput={oninput}
          />
        )}
      </div>
    );
  }

  view() {
    this.syncOther();

    return (
      <div className="CanelaDraft">
        {this.section() === 'texts' ? this.textsView() : this.layoutView()}

        {actions(
          this.dirty(),
          [
            { label: trans(`${KEY}.preview_login`, 'Pré-visualizar entrar'), open: () => openPreview('/login', this.previewState()) },
            { label: trans(`${KEY}.preview_signup`, 'Pré-visualizar cadastro'), open: () => openPreview('/signup', this.previewState()) },
          ],
          () => this.apply(),
          () => (this.draft = savedAuth())
        )}
      </div>
    );
  }

  layoutView() {
    const layouts: Record<string, string> = {
      card: trans(`${AUTH}.layout_card`, 'Cartão único sobre o fundo (padrão)'),
      discourse: trans(`${AUTH}.layout_discourse`, 'Discourse: sem cartão, login social ao lado'),
      split: trans(`${AUTH}.layout_split`, 'Tela dividida: painel colorido à esquerda'),
    };

    return [
      <div className="Form-group">
        <label className="CanelaAdmin-label">{trans(`${AUTH}.layout_label`, 'Leiaute')}</label>
        <div className="CanelaAdmin-select-wrap">
          <select
            className="FormControl CanelaAdmin-select"
            value={this.draft.layout}
            onchange={(event: Event) => (this.draft.layout = (event.target as HTMLSelectElement).value)}
          >
            {Object.keys(layouts).map((key) => (
              <option key={key} value={key}>
                {layouts[key]}
              </option>
            ))}
          </select>
          <i className="fas fa-chevron-down CanelaAdmin-select-chevron" aria-hidden="true" />
        </div>
        <p className="helpText">
          {trans(
            `${AUTH}.layout_help`,
            'Em todos, a página fica sem o cabeçalho, só com o logo do fórum. Com login social, os botões vêm antes do formulário (no do Discourse, ao lado dele).'
          )}
        </p>
      </div>,

      <BackgroundPicker
        target="auth"
        label={trans(`${AUTH}.background_label`, 'Fundo das páginas de entrar e cadastrar')}
        help={trans(
          `${AUTH}.background_help`,
          'Na tela dividida, a imagem vai para o painel da esquerda; os outros fundos ficam atrás do formulário.'
        )}
        value={this.draft.background}
        onchange={(value: string) => (this.draft.background = value)}
      />,
    ];
  }

  textsView() {
    const empty = trans(`${AUTH}.text_default`, 'Vazio: o texto padrão');

    return [
      <h4 className="CanelaDraft-subtitle">{trans(`${AUTH}.texts_login`, 'Textos da página de entrar')}</h4>,
      <div className="CanelaDraft-row">
        {this.text('canela.auth_login_title', trans(`${AUTH}.title_label`, 'Título'), empty)}
        {this.text('canela.auth_login_subtitle', trans(`${AUTH}.subtitle_label`, 'Subtítulo (opcional)'), empty)}
      </div>,

      <h4 className="CanelaDraft-subtitle">{trans(`${AUTH}.texts_signup`, 'Textos da página de cadastro')}</h4>,
      <div className="CanelaDraft-row">
        {this.text('canela.auth_signup_title', trans(`${AUTH}.title_label`, 'Título'), empty)}
        {this.text('canela.auth_signup_subtitle', trans(`${AUTH}.subtitle_label`, 'Subtítulo (opcional)'), empty)}
      </div>,

      // Só com a tela dividida aplicada no card "Leiaute e fundo".
      this.draft.layout === 'split' && [
        <h4 className="CanelaDraft-subtitle">{trans(`${AUTH}.texts_panel`, 'Painel da tela dividida')}</h4>,
        <div className="CanelaDraft-row">
          {this.text('canela.auth_panel_login_title', trans(`${AUTH}.panel_login_title`, 'Título no login'), empty)}
          {this.text('canela.auth_panel_signup_title', trans(`${AUTH}.panel_signup_title`, 'Título no cadastro'), empty)}
        </div>,
        <div className="CanelaDraft-row">
          {this.text('canela.auth_panel_login_text', trans(`${AUTH}.panel_login_text`, 'Texto no login'), empty, true)}
          {this.text('canela.auth_panel_signup_text', trans(`${AUTH}.panel_signup_text`, 'Texto no cadastro'), empty, true)}
        </div>,
      ],
    ];
  }
}
