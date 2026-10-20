/*
 * /login e /signup: as páginas cheias de entrar e de cadastro do Discourse
 * (`.login-fullpage`/`.signup-fullpage`) — o logo do fórum, o título grande,
 * o formulário, "Esqueci minha senha", os botões sociais (fof/oauth) e o link
 * para a outra página.
 *
 * Nada de reescrever o POST: o formulário é o próprio LogInModal/SignUpModal
 * do core, desenhado dentro da página por uma subclasse. Assim valem as
 * validações do core, os campos que as extensões põem nos modais (fof/terms,
 * convites…) e o que o tema já faz neles (rótulo flutuante, títulos).
 */
import app from 'flarum/forum/app';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { applyBackground } from '../../shell/backgrounds';

export type AuthMode = 'login' | 'signup' | 'forgot';
export type AuthLayout = 'card' | 'discourse' | 'split';

const MODULES: Record<AuthMode, string> = {
  login: 'flarum/forum/components/LogInModal',
  signup: 'flarum/forum/components/SignUpModal',
  forgot: 'flarum/forum/components/ForgotPasswordModal',
};

const RETURN_KEY = 'canela.authReturn';

/** Valores levados de uma página para a outra (o e-mail digitado no login vai para o cadastro), fora da URL. */
let carried: Record<string, unknown> = {};

/** Guarda a página de onde a pessoa veio: depois de entrar, ela volta para lá. */
export function rememberReturn(): void {
  const route = m.route.get();

  if (!route || /^\/(login|signup|forgot-password|reset)\b/.test(route)) return;

  try {
    sessionStorage.setItem(RETURN_KEY, route);
  } catch {
    // Sem armazenamento a pessoa volta para a página inicial.
  }
}

function takeReturn(): string {
  try {
    const route = sessionStorage.getItem(RETURN_KEY);

    sessionStorage.removeItem(RETURN_KEY);

    // Só caminhos do próprio fórum.
    if (route && route.startsWith('/') && !route.startsWith('//')) return route;
  } catch {
    // Idem.
  }

  return app.route('index');
}

export function goToAuth(mode: AuthMode, attrs: Record<string, unknown> = {}): void {
  carried = attrs;
  m.route.set(app.route(`canela.${mode}`));
}

/** A subclasse de cada modal, criada uma vez quando o módulo chega. */
const classes: Partial<Record<AuthMode, any>> = {};

function pageClass(mode: AuthMode, Base: any): any {
  if (classes[mode]) return classes[mode];

  classes[mode] = class extends Base {
    // Na página não há o que fechar: o ✕ some e o Esc não faz nada.
    static isDismissibleViaCloseButton = false;
    static isDismissibleViaEscKey = false;
    static isDismissibleViaBackdropClick = false;

    className() {
      return `${super.className()} CanelaAuthForm`;
    }

    // Entre os botões sociais e o formulário, o "ou" (some pelo CSS quando
    // não há login social, e no leiaute do Discourse, que tem o traço).
    body() {
      const content = super.body();

      if (!Array.isArray(content) || !content[0]) return content;

      return [
        content[0],
        <div className="CanelaAuthPage-or" aria-hidden="true">
          <span>{t('auth.or')}</span>
        </div>,
        ...content.slice(1),
      ];
    }

    hide() {
      m.route.set(app.route('index'));
    }

    // "Redefinir senha" no lugar de "Redefinição de senha": é o título da página.
    title() {
      return mode === 'forgot' ? t('auth.forgot_heading') : super.title();
    }

    forgotPassword() {
      const email = String(this.identification?.() || '');

      goToAuth('forgot', email.includes('@') ? { email } : {});
    }

    // Entre as duas páginas, a navegação é de página, não de modal.
    signUp() {
      const identification = String(this.identification?.() || '');

      goToAuth('signup', identification ? { [identification.includes('@') ? 'email' : 'username']: identification } : {});
    }

    logIn() {
      const identification = String(this.email?.() || this.username?.() || '');

      goToAuth('login', identification ? { identification } : {});
    }
  };

  return classes[mode];
}

/**
 * Sem o cabeçalho e com o fundo destas páginas (o PreBootShell já faz isso
 * quando a página abre direto nelas); ao sair, o fundo do fórum volta.
 */
export function enterAuthRoute(): void {
  document.documentElement.classList.add('CanelaAuthRoute');
  applyBackground('auth');
}

export function leaveAuthRoute(): void {
  document.documentElement.classList.remove('CanelaAuthRoute');
  applyBackground('forum');
}

/** "Voltar para entrar", debaixo do cartão das páginas de senha. */
export function backToLogin(): Mithril.Children {
  return (
    <p className="CanelaAuthPage-back">
      <a
        href={app.route('canela.login')}
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          goToAuth('login');
        }}
      >
        {t('auth.back_to_login')}
      </a>
    </p>
  );
}

/** O ModalManager que o modal espera, sem modal nenhum: abre na hora e não anima a saída. */
const embeddedState = { modal: {}, close() {} };

export default class AuthPage extends Page<IPageAttrs> {
  protected bodyClass = 'Canela--authPage';
  form: any = null;
  formAttrs: Record<string, unknown> = {};

  mode(): AuthMode {
    const name = this.attrs.routeName;

    return name === 'canela.signup' ? 'signup' : name === 'canela.forgot' ? 'forgot' : 'login';
  }

  layout(): AuthLayout {
    const value = app.forum.attribute<string>('canelaAuthLayout');

    return value === 'discourse' || value === 'split' ? value : 'card';
  }

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>) {
    super.oninit(vnode);

    // Já entrou (inclusive logo depois do login, que recarrega a página):
    // volta para onde estava.
    if (app.session.user) {
      m.route.set(takeReturn(), undefined, { replace: true });
      return;
    }

    const mode = this.mode();

    if (mode === 'signup' && !app.forum.attribute<boolean>('allowSignUp')) {
      m.route.set(app.route('canela.login'), undefined, { replace: true });
      return;
    }

    this.formAttrs = carried;
    carried = {};

    app.setTitle(t(`auth.${mode}_page_title`));
    app.setTitleCount(0);

    (flarum as any).reg.asyncModuleImport(MODULES[mode]).then((module: any) => {
      this.form = pageClass(mode, module.default ?? module);
      m.redraw();
    });
  }

  oncreate(vnode: Mithril.VnodeDOM<IPageAttrs, this>) {
    super.oncreate(vnode);

    enterAuthRoute();
  }

  onremove(vnode: Mithril.VnodeDOM<IPageAttrs, this>) {
    super.onremove(vnode);

    leaveAuthRoute();
  }

  view() {
    const Form = this.form;
    const mode = this.mode();
    const layout = this.layout();

    return (
      <div className={`CanelaAuthPage CanelaAuthPage--${mode} CanelaAuthPage--layout-${layout}`}>
        {layout === 'split' ? this.panel(mode) : null}
        <div className="CanelaAuthPage-inner">
          {this.logo()}
          {Form ? (
            <Form state={embeddedState} animateShow={(ready: () => void) => ready()} animateHide={() => {}} {...this.formAttrs} />
          ) : (
            <LoadingIndicator display="block" />
          )}
          {mode === 'forgot' ? backToLogin() : null}
        </div>
      </div>
    );
  }

  logo(): Mithril.Children {
    return authLogo();
  }

  /** O painel colorido da tela dividida: o logo, o título e a frase do admin (ou os padrões). */
  panel(mode: AuthMode): Mithril.Children {
    const title = String(app.forum.attribute('canelaAuthSplitTitle') || '').trim();
    const text = String(app.forum.attribute('canelaAuthSplitText') || '').trim();
    const key = mode === 'signup' ? 'signup' : 'login';

    return (
      <aside className="CanelaAuthPanel">
        <div className="CanelaAuthPanel-logo">{authLogo()}</div>
        <div className="CanelaAuthPanel-body">
          <h2 className="CanelaAuthPanel-title">{title || t(`auth.panel_${key}_title`)}</h2>
          <p className="CanelaAuthPanel-text">{text || t(`auth.panel_${key}_text`)}</p>
        </div>
      </aside>
    );
  }
}

/** O logo do fórum em cima do cartão (a versão escura no tema escuro). */
export function authLogo(): Mithril.Children {
  const title = app.forum.attribute<string>('title');
  const logo = app.forum.attribute<string | null>('logoUrl');
  const dark = app.forum.attribute<string | null>('logoDarkModeUrl');

  return (
    <a className="CanelaAuthPage-logo" href={app.route('index')} aria-label={title}>
      {logo ? (
        [
          <img className={`CanelaAuthPage-logoImage${dark ? ' CanelaAuthPage-logoImage--light' : ''}`} src={logo} alt="" />,
          dark ? <img className="CanelaAuthPage-logoImage CanelaAuthPage-logoImage--dark" src={dark} alt="" /> : null,
        ]
      ) : (
        <span className="CanelaAuthPage-logoText">{title}</span>
      )}
    </a>
  );
}
