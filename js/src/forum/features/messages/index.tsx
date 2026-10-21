/*
 * As mensagens pessoais sobre o flarum/messages:
 *
 * - a aba "Mensagens" do perfil com as caixas (UserMessagesPage);
 * - a conversa como tópico de mensagem (topic.tsx);
 * - o composer de mensagem (composer.tsx);
 * - "Minhas mensagens" na barra lateral, com a contagem;
 * - "✉ Mensagem" no cartão de usuário e no perfil.
 *
 * Tudo depende do flarum/messages estar ligado (e de `canela.messages_enabled`);
 * sem ele nada muda. O menu do usuário (aba de mensagens) é de outra área: ele
 * lê `app.dialogs` e as rotas `dialog` / `user.messages` daqui.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserPage from 'flarum/forum/components/UserPage';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import UserControls from 'flarum/forum/utils/UserControls';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import CanelaSidebar from '../../components/CanelaSidebar';
import installComposerActions from './composerActions';
import { beforeChunk, once } from '../../utils/chunkGate';
import { t } from '../../utils/settings';
import { hasProfileRoute, messagesOn, myMessagesHref, totalUnread } from './util';

/** A rota atual é das mensagens (caixas do perfil ou uma conversa). */
function onMessagesRoute(): boolean {
  const name = app.current.get('routeName') || '';

  return /^user\.messages/.test(name) || ['messages', 'dialog', 'dialog.message'].includes(name);
}

function installProfileTab(): void {
  // Mensagens são pessoais: a aba só aparece no próprio perfil (`viewingSelf`).
  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    if (!messagesOn() || !hasProfileRoute() || !this.user || app.session.user !== this.user) return;

    items.add(
      'messages',
      <LinkButton
        href={app.route('user.messages', { username: this.user.slug() })}
        icon="far fa-envelope"
        active={/^user\.messages/.test(app.current.get('routeName') || '')}
      >
        {t('messages.page.nav')}
      </LinkButton>,
      // Depois de Atividade/Notificações e antes de Emblemas.
      30
    );
  });
}

function installSidebar(): void {
  const apply = (items: ItemList<Mithril.Children>) => {
    if (!messagesOn() || !app.session.user) return;

    // O "Mensagens" que o flarum/messages põe na navegação repetiria o
    // "Minhas mensagens" do tema.
    if (items.has('messages')) items.remove('messages');

    const count = totalUnread();
    const link = (
      <LinkButton
        href={myMessagesHref()}
        icon="fas fa-inbox"
        active={onMessagesRoute()}
        title={count ? t('messages.sidebar.unread', { count }) : undefined}
      >
        {t('messages.sidebar.my_messages')}
        {count ? <span className="CanelaSidebar-suffix CanelaSidebar-count">{count}</span> : null}
      </LinkButton>
    );

    if (items.has('myMessages')) items.setContent('myMessages', link);
    else items.add('myMessages', link, 55);
  };

  // Registrado no primeiro desenho da barra, para rodar depois dos outros
  // extends dela (a barra de "Início" também mexe nesse item): o endereço da
  // caixa do perfil, o ativo nas mensagens e a contagem sem o arquivo ficam.
  let registered = false;

  extend(CanelaSidebar.prototype, 'communityItems', function () {
    if (registered) return;
    registered = true;

    extend(CanelaSidebar.prototype, 'communityItems', apply);
  });
}

/**
 * "✉ Mensagem" (`user.private_message`) no lugar do "Enviar uma mensagem"
 * do flarum/messages. Pelo `controls`, que junta as seções: o item já existe
 * quando ele roda, seja qual for a ordem das extensões.
 */
function installMessageButton(): void {
  extend(UserControls as any, 'controls', function (items: ItemList<Mithril.Children>) {
    if (!messagesOn() || !items.has('sendMessage')) return;

    const vnode: any = items.get('sendMessage');

    if (!vnode?.attrs) return;

    items.setContent(
      'sendMessage',
      <Button {...vnode.attrs} icon="fas fa-envelope">
        {t('messages.user.message')}
      </Button>
    );
  });
}

/**
 * As telas do flarum/messages vêm em chunks dele; as extensões do tema para
 * elas, num chunk nosso, que desce antes de qualquer chunk de lá.
 */
function installUiLoader(): void {
  const loadUi = once(() => import('./ui').then((mod) => mod.default()));

  beforeChunk((namespace) => namespace === 'flarum-messages', loadUi);
}

export default function installMessages(): void {
  installProfileTab();
  installSidebar();
  installMessageButton();
  installComposerActions();
  installUiLoader();
}
