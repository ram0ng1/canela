/*
 * Entrar, Cadastrar-se e Esqueci a senha com a cara de páginas de login: o
 * título grande ("Boas-vindas outra vez", "Criar sua
 * conta"), campos com o rótulo flutuante (o
 * rótulo mora dentro do campo e sobe para a borda ao focar ou preencher) e o
 * "Esqueci minha senha" logo abaixo da senha.
 *
 * O resto dos modais (`.d-modal`) é só CSS (less/forum/Components.less).
 *
 * Os três modais vêm em pedaços carregados sob demanda: estendidos pelo nome.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';

/**
 * Transforma o `.Form-group` do campo `key` num grupo de rótulo flutuante: o
 * texto do placeholder (ou do `<label>` que o core põe em cima) vira um rótulo
 * depois do campo, e o placeholder fica " " para o CSS saber, por
 * `:placeholder-shown`, se há texto.
 */
function floatLabel(items: ItemList<Mithril.Children>, key: string): void {
  if (!items.has(key)) return;

  const group: any = items.get(key);
  const children: any[] = Array.isArray(group?.children) ? group.children : [];
  const inputIndex = children.findIndex((child) => child?.tag === 'input');

  if (inputIndex < 0) return;

  const input = children[inputIndex];
  const labelIndex = children.findIndex((child) => child?.tag === 'label');
  const text = input.attrs.placeholder || input.attrs['aria-label'] || '';

  if (!text) return;

  if (labelIndex >= 0) children.splice(labelIndex, 1);

  input.attrs.placeholder = ' ';
  group.attrs.className = `${group.attrs.className || ''} CanelaFloat`;
  // O rótulo não recebe clique: o toque cai no campo, por baixo dele.
  children.push(
    <label className="CanelaFloat-label" aria-hidden="true">
      {text}
    </label>
  );
}

export default function installModals() {
  const LOGIN = 'flarum/forum/components/LogInModal';
  const SIGNUP = 'flarum/forum/components/SignUpModal';
  const FORGOT = 'flarum/forum/components/ForgotPasswordModal';

  override(LOGIN as any, 'title', () => t('modals.login_title'));
  override(SIGNUP as any, 'title', () => t('modals.signup_title'));

  extend(LOGIN as any, 'fields', function (this: any, items: ItemList<Mithril.Children>) {
    // O rótulo "E-mail/nome do(a) usuário(a)".
    const identification: any = items.has('identification') ? items.get('identification') : null;
    const input = (Array.isArray(identification?.children) ? identification.children : []).find((child: any) => child?.tag === 'input');

    if (input) input.attrs.placeholder = input.attrs['aria-label'] = t('modals.identification');

    floatLabel(items, 'identification');
    floatLabel(items, 'password');

    // "Esqueci minha senha" debaixo da senha (o link do
    // rodapé do core some pelo CSS).
    items.add(
      'canelaForgot',
      <div className="Form-group CanelaLogin-forgot">
        <Button className="Button Button--link Button--text" type="button" onclick={() => this.forgotPassword()}>
          {t('modals.forgot_password')}
        </Button>
      </div>,
      15
    );
  });

  // "Não tem uma conta?" e, embaixo, "Cadastrar-se" (o core junta os dois
  // numa frase com "Cadastre-se").
  override(LOGIN as any, 'footer', function (this: any, original: () => Mithril.Children) {
    if (!app.forum.attribute<boolean>('allowSignUp')) return original();

    return (
      <p className="LogInModal-signUp">
        {t('modals.no_account')}{' '}
        <Button className="Button Button--text Button--link" onclick={() => this.signUp()}>
          {t('modals.sign_up')}
        </Button>
      </p>
    );
  });

  extend(SIGNUP as any, 'fields', function (items: ItemList<Mithril.Children>) {
    ['username', 'email', 'password'].forEach((key) => floatLabel(items, key));
  });

  // "Redefinição de senha" é um modal comum (não a página de
  // login): título no cabeçalho, o texto em negrito, o campo com placeholder e
  // "Redefinir senha" no rodapé, apagado até haver um e-mail.
  override(FORGOT as any, 'title', () => t('modals.forgot_title'));

  // Sinalizar: "Obrigado por ajudar a manter a
  // nossa comunidade civilizada!", os nomes dos motivos ("Fora do
  // tópico", "Algo mais") e "Sinalizar postagem" no rodapé.
  const FLAG = 'ext:flarum/flags/forum/components/FlagPostModal';
  const FLAG_LABELS: Record<string, string> = { 'off-topic': 'modals.flag_off_topic', other: 'modals.flag_other' };

  override(FLAG as any, 'title', () => t('modals.flag_title'));

  extend(FLAG as any, 'flagReasons', function (items: ItemList<Mithril.Children>) {
    Object.entries(FLAG_LABELS).forEach(([key, label]) => {
      const item: any = items.has(key) ? items.get(key) : null;
      const children: any[] = Array.isArray(item?.children) ? item.children : [];
      const index = children.findIndex((child: any) => child?.tag === 'strong');

      // Os filhos de um elemento já são vnodes normalizados: troca o vnode
      // inteiro em vez de pôr texto cru dentro dele.
      if (index >= 0) children[index] = <strong>{t(label)}</strong>;
    });
  });

  extend(FLAG as any, 'content', function (this: any, vnode: any) {
    if (this.success) return;

    // O botão de enviar é o último `Button--primary` do formulário.
    const walk = (node: any): any => {
      if (!node || typeof node !== 'object') return null;
      if (Array.isArray(node)) return node.map(walk).find(Boolean) || null;
      if (node.attrs?.type === 'submit') return node;

      return walk(node.children);
    };
    const submit = walk(vnode);

    if (submit) submit.children = [t('modals.flag_submit')];
  });

  extend(FORGOT as any, 'fields', function (this: any, items: ItemList<Mithril.Children>) {
    if (!items.has('submit')) return;

    const group: any = items.get('submit');
    const button = (Array.isArray(group?.children) ? group.children : [group?.children]).find((child: any) => child?.attrs);

    if (!button) return;

    button.attrs.className = 'Button Button--primary';
    button.attrs.disabled = !String(this.email() || '').trim();
    button.children = [t('modals.forgot_submit')];
  });
}
