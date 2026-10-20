/*
 * /reset/{token}: "Redefinir senha" com a cara das páginas de entrar (logo,
 * cartão, título, campos com rótulo flutuante), no lugar da página solta do
 * core. O servidor (src/Auth/ResetPasswordContent) valida o token como o
 * core e entrega o token e os erros da última tentativa; o formulário posta
 * no POST /reset do core (SavePasswordController), que troca a senha, entra
 * e volta para a página inicial — ou, num erro, volta para cá com os erros.
 */
import app from 'flarum/forum/app';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { authLogo, backToLogin, enterAuthRoute, leaveAuthRoute } from './AuthPage';

interface ResetPayload {
  token: string;
  errors: string[];
}

export default class ResetPasswordPage extends Page<IPageAttrs> {
  protected bodyClass = 'Canela--authPage';
  loading = false;

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>) {
    super.oninit(vnode);

    app.setTitle(t('auth.reset_heading'));
    app.setTitleCount(0);
  }

  payload(): ResetPayload | null {
    const data = (app.data as any).canelaReset as ResetPayload | undefined;

    // Só vale o token da própria URL (o payload é o do primeiro carregamento).
    return data && data.token === m.route.param('token') ? data : null;
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
    const data = this.payload();

    return (
      <div className="CanelaAuthPage CanelaAuthPage--reset CanelaAuthPage--layout-card">
        <div className="CanelaAuthPage-inner">
          {authLogo()}
          <div className="Modal modal-dialog CanelaAuthForm CanelaResetForm">
            <div className="Modal-content">{data ? this.form(data) : this.unavailable()}</div>
          </div>
          {backToLogin()}
        </div>
      </div>
    );
  }

  form(data: ResetPayload): Mithril.Children {
    return (
      <form method="POST" action={`${app.forum.attribute<string>('baseUrl')}/reset`} onsubmit={() => (this.loading = true)}>
        <div className="Modal-header">
          <h3 className="App-titleControl App-titleControl--text">{t('auth.reset_heading')}</h3>
        </div>
        {data.errors.length ? (
          <div className="Modal-alert">
            <div className="Alert Alert--error" role="alert">
              <span className="Alert-body">
                {data.errors.map((error) => (
                  <p>{error}</p>
                ))}
              </span>
            </div>
          </div>
        ) : null}
        <div className="Modal-body">
          <div className="Form Form--centered">
            <input type="hidden" name="csrfToken" value={app.session.csrfToken} />
            <input type="hidden" name="passwordToken" value={data.token} />
            <p className="helpText">{t('auth.reset_help')}</p>
            {this.field('password', t('auth.reset_new_password'), true)}
            {this.field('password_confirmation', t('auth.reset_confirm_password'), false)}
            <div className="Form-group">
              <Button className="Button Button--primary Button--block" type="submit" loading={this.loading}>
                {t('auth.reset_submit')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    );
  }

  field(name: string, label: string, focus: boolean): Mithril.Children {
    return (
      <div className="Form-group CanelaFloat">
        <input
          className="FormControl"
          type="password"
          name={name}
          autocomplete="new-password"
          placeholder=" "
          aria-label={label}
          required
          minlength={8}
          oncreate={focus ? (vnode: Mithril.VnodeDOM) => (vnode.dom as HTMLInputElement).focus() : undefined}
        />
        <label className="CanelaFloat-label" aria-hidden="true">
          {label}
        </label>
      </div>
    );
  }

  /** Chegou aqui navegando dentro do fórum (sem o payload do servidor): recarrega a página. */
  unavailable(): Mithril.Children {
    return (
      <div className="Modal-body">
        <p className="helpText">
          <a href={window.location.href} onclick={() => window.location.reload()}>
            {t('auth.reset_heading')}
          </a>
        </p>
      </div>
    );
  }
}
