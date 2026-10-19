/*
 * A conversa do flarum/messages como o tópico de mensagem pessoal do
 * Discourse (`archetype-private_message`):
 *
 *   ✉ Título da mensagem
 *   ┌──────────────────────────────────────┐  cada mensagem numa caixa de
 *   │ (avatar) nome            data        │  borda fina; as minhas tingidas
 *   │ texto…                               │  com a cor de destaque
 *   └──────────────────────────────────────┘
 *   ┌ mapa: N mensagens · avatares ────────┐  depois da primeira mensagem
 *   │ [👤 ana ✕] [👤 ramon]                 │  (`private-message-map`)
 *   └──────────────────────────────────────┘
 *   …
 *   🔗  🗂 Arquivar ............... [↩ Responder]
 *
 * No flarum/messages a lista de conversas e a conversa aberta dividem a mesma
 * página, como um chat; no Discourse a lista mora no perfil e a mensagem é um
 * tópico. Aqui `/messages` leva à caixa de entrada do perfil e
 * `/messages/dialog/:id` desenha só a conversa, no formato do tópico.
 *
 * MessagesPage, DialogSection, MessageStream e Message vêm num pedaço
 * carregado sob demanda: são estendidos pelo nome do módulo.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import PageStructure from 'flarum/forum/components/PageStructure';
import Page from 'flarum/common/components/Page';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Tooltip from 'flarum/common/components/Tooltip';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { shareLink } from '../../utils/topicShare';
import { toggleArchive } from './actions';
import { refreshCounts } from './BoxListState';
import { DialogEventView, DialogMap, DialogNotifications, DialogTimeline, dialogEvents, levelsOn, notificationReason } from './conversation';
import {
  boxesOn,
  boxHref,
  dialogHref,
  dialogTitle,
  hasProfileRoute,
  isArchived,
  messageCount,
  messagesOn,
  myMessagesHref,
  openMessageComposer,
  groupLabel,
  staffGroups,
  type Dialog,
  type DialogMessage,
} from './util';

const PAGE = 'ext:flarum/messages/forum/components/MessagesPage';
const SECTION = 'ext:flarum/messages/forum/components/DialogSection';
const STREAM = 'ext:flarum/messages/forum/components/MessageStream';
const MESSAGE = 'ext:flarum/messages/forum/components/Message';

/** O endereço absoluto de uma conversa (para copiar / compartilhar). */
function absoluteDialogUrl(dialog: Dialog, near?: number): string {
  return app.forum.attribute<string>('baseOrigin') + dialogHref(dialog, near);
}

/**
 * Abre o composer respondendo à conversa. Quem recebe a mensagem enviada é o
 * próprio stream (o `receive` dele rola até ela e marca como lida), guardado
 * no estado quando ele é criado.
 */
function replyTo(dialog: Dialog, stream: any): void {
  openMessageComposer({
    replyingTo: dialog,
    onsubmit: (message: DialogMessage) => {
      if (stream && typeof stream.receive === 'function') stream.receive(message);
    },
  }).catch(() => {});
}

function installPage(): void {
  // `/messages` sozinho é a caixa de entrada — a do perfil, como no Discourse.
  override(PAGE as any, 'oninit', function (this: any, original: (vnode: any) => void, vnode: any) {
    if (messagesOn() && hasProfileRoute() && app.session.user && !m.route.param('id')) {
      // Só o oninit do Page (atributos, classe do body): o do MessagesPage
      // carregaria a lista e abriria a primeira conversa à toa.
      Page.prototype.oninit.call(this, vnode);
      m.route.set(myMessagesHref(), {}, { replace: true });
      return;
    }

    return original(vnode);
  });

  override(PAGE as any, 'view', function (this: any, original: () => Mithril.Children) {
    if (!messagesOn() || !m.route.param('id')) {
      return messagesOn() && hasProfileRoute() ? <LoadingIndicator display="block" /> : original();
    }

    const dialog: Dialog | null = this.selectedDialog();

    // Sem o hero e sem a barra do flarum/messages: o título vai dentro do
    // cartão, e a coluna da direita (a da linha do tempo no tópico) fica vazia.
    return (
      <PageStructure className="MessagesPage CanelaTopic CanelaDialogPage" loading={false} hero={() => null} sidebar={() => null}>
        {dialog ? (
          m(flarum.reg.get('flarum-messages', 'forum/components/DialogSection'), {
            key: dialog.id(),
            dialog,
            onback: () => m.route.set(myMessagesHref()),
          })
        ) : (
          <LoadingIndicator display="block" />
        )}
      </PageStructure>
    );
  });
}

/**
 * Conta a visualização ao abrir a conversa (uma por pessoa a cada janela, no
 * servidor) e atualiza o número da lista.
 */
function recordView(dialog: Dialog): void {
  if (!boxesOn()) return;

  app
    .request<{ viewCount: number | null }>({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/dialogs/${dialog.id()}/canela-view` })
    .then((result) => {
      if (result && typeof result.viewCount === 'number') dialog.pushAttributes({ viewCount: result.viewCount });
    })
    .catch(() => {});
}

function installSection(): void {
  extend(SECTION as any, 'oninit', function (this: any) {
    if (messagesOn() && this.attrs?.dialog) recordView(this.attrs.dialog);
  });

  override(SECTION as any, 'view', function (this: any, original: () => Mithril.Children) {
    if (!messagesOn()) return original();

    const dialog: Dialog = this.attrs.dialog;
    const Stream = flarum.reg.get('flarum-messages', 'forum/components/MessageStream');
    const groups = staffGroups(dialog);

    // Duas colunas, como o tópico: o stream na largura de leitura e, à
    // direita, a linha do tempo que acompanha a rolagem.
    return (
      <div className="DialogSection CanelaDialog">
        <div className="DiscussionHero CanelaTopicHero CanelaDialogHero">
          <div className="container">
            <h1 className="DiscussionHero-title CanelaDialogHero-title">
              <span className="private-message-glyph-wrapper" title={t('messages.topic.glyph')}>
                <Icon name="far fa-envelope" className="private-message-glyph" />
              </span>
              {dialogTitle(dialog)}
            </h1>
            {groups.length ? (
              <div className="CanelaDialogHero-groups">
                {groups.map((group) => (
                  <span className="CanelaParticipantGroup">
                    <Icon name="fas fa-user-group" />
                    <span>{groupLabel(group)}</span>
                  </span>
                ))}
              </div>
            ) : null}
            {this.recipientCannotReply() ? (
              <p className="CanelaDialogHero-notice">{app.translator.trans('flarum-messages.forum.dialog_section.cannot_reply_text')}</p>
            ) : null}
          </div>
        </div>
        <div className="CanelaDialog-columns">
          <div className="CanelaDialog-main">
            <Stream dialog={dialog} state={this.messages} near={this.near} />
            <DialogFooter dialog={dialog} state={this.messages} />
          </div>
          <aside className="CanelaDialog-aside">
            <DialogTimeline dialog={dialog} onreply={() => replyTo(dialog, this.messages?.canelaStream)} />
          </aside>
        </div>
      </div>
    );
  });
}

interface DialogFooterAttrs extends ComponentAttrs {
  dialog: Dialog;
  state: any;
}

/** "● Marcar não lido" (`defer`): a leitura volta para antes da última mensagem. */
function markUnread(dialog: Dialog): void {
  app
    .request({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/dialogs/${dialog.id()}/canela-unread` })
    .then(() => {
      refreshCounts();
      if (app.session.user) m.route.set(boxHref(app.session.user, 'inbox'));
    })
    .catch(() => {});
}

/**
 * Os botões do fim do tópico de mensagem (`topic-footer-buttons` de uma
 * mensagem): compartilhar só com o ícone, "Arquivar" / "Mover para caixa de
 * entrada", "● Marcar não lido" e, em destaque, "Responder"; embaixo, o
 * controle de notificação com o motivo.
 */
class DialogFooter extends Component<DialogFooterAttrs> {
  view(): Mithril.Children {
    const { dialog, state } = this.attrs;
    const archived = isArchived(dialog);
    const canReply = dialog.canSendMessage() !== false;

    return (
      <div className="CanelaTopicFooter CanelaDialogFooter" role="group" aria-label={t('messages.topic.footer_label')}>
        <div className="CanelaTopicFooter-main">
          <div className="CanelaTopicFooter-actions">
            <Tooltip text={t('messages.topic.share')}>
              <Button
                className="Button Button--icon CanelaTopicFooter-share"
                icon="fas fa-arrow-up-from-bracket"
                aria-label={t('messages.topic.share')}
                onclick={() => shareLink(absoluteDialogUrl(dialog), dialogTitle(dialog))}
              />
            </Tooltip>
            {boxesOn() ? (
              <Button
                className="Button CanelaDialogFooter-archive"
                icon={archived ? 'far fa-envelope' : 'far fa-folder'}
                title={archived ? t('messages.topic.move_to_inbox_help') : t('messages.topic.archive_help')}
                onclick={() => toggleArchive(dialog)}
              >
                {archived ? t('messages.topic.move_to_inbox') : t('messages.topic.archive')}
              </Button>
            ) : null}
            {boxesOn() && messageCount(dialog) > 0 ? (
              <Button
                className="Button CanelaDialogFooter-defer"
                icon="fas fa-circle"
                title={t('messages.topic.defer_help')}
                onclick={() => markUnread(dialog)}
              >
                {t('messages.topic.defer')}
              </Button>
            ) : null}
            {canReply ? (
              <Button
                className="Button Button--primary CanelaTopicFooter-reply"
                icon="fas fa-reply"
                onclick={() => replyTo(dialog, state?.canelaStream)}
              >
                {t('messages.topic.reply')}
              </Button>
            ) : (
              <Button className="Button CanelaTopicFooter-reply disabled" icon="fas fa-reply" disabled>
                {app.translator.trans('flarum-messages.forum.dialog_section.cannot_reply_text')}
              </Button>
            )}
          </div>
        </div>
        {levelsOn(dialog) ? (
          <div className="CanelaTopicFooter-notifications">
            <DialogNotifications dialog={dialog} />
            <p className="CanelaTopicFooter-reason">{notificationReason(dialog)}</p>
          </div>
        ) : null}
      </div>
    );
  }
}

function installStream(): void {
  // O stream deixa de ser uma caixa com rolagem própria (o chat do
  // flarum/messages): rola a página, como um tópico. As contas de rolagem
  // dele passam a valer para a janela.
  extend(STREAM as any, 'oncreate', function (this: any) {
    if (this.attrs?.state) this.attrs.state.canelaStream = this;
  });

  override(STREAM as any, 'scrollToBottom', function (this: any, original: () => void) {
    if (!messagesOn()) return original();

    // Como o Discourse ao abrir uma mensagem já lida: na última postagem.
    const items = this.element?.querySelectorAll('.MessageStream-item[data-id]');
    const last = items && items.length ? (items[items.length - 1] as HTMLElement) : null;

    if (last && last.getBoundingClientRect().bottom > window.innerHeight) last.scrollIntoView({ block: 'start' });
  });

  override(STREAM as any, 'scrollToStart', function (this: any, original: () => void) {
    if (!messagesOn()) return original();

    const near = this.attrs.near;
    const target = near ? (this.element.querySelector(`.MessageStream-item[data-number="${near}"]`) as HTMLElement | null) : null;

    if (!target) return this.scrollToBottom();

    target.scrollIntoView({ block: 'center' });
    target.classList.add('flash');
    window.history.replaceState(null, '', dialogHref(this.attrs.dialog));
  });

  // Sem a caixa "Escreva uma resposta…": o tópico do Discourse tem o botão
  // "Responder" no rodapé.
  extend(STREAM as any, 'content', function (this: any, items: Mithril.Vnode[]) {
    if (!messagesOn() || !Array.isArray(items)) return;

    const index = items.findIndex((item: any) => item && item.key === 'reply');

    if (index !== -1) items.splice(index, 1);
  });

  // Os posts de ação pequena entram pela hora: os que aconteceram antes de
  // cada mensagem vão em cima dela; os depois da última, no fim do fluxo.
  override(STREAM as any, 'content', function (this: any, original: () => Mithril.Vnode[]) {
    this.canelaPrevTime = null;

    const items = original();

    if (!messagesOn() || !Array.isArray(items)) return items;

    // Os eventos (`canelaEvents`) só vêm no "show" da conversa; aberta a
    // partir da lista, ela chega sem eles e eles só apareciam depois de uma
    // ação que recarregasse a conversa. Busca o show uma vez quando faltarem.
    const dialog = this.attrs.dialog;

    if (dialog && dialog.attribute('canelaEvents') === undefined && !dialog.canelaEventsRequested) {
      dialog.canelaEventsRequested = true;
      app.store.find('dialogs', dialog.id()).then(() => m.redraw());
    }

    const last = this.canelaPrevTime as number | null;
    const tail = dialogEvents(this.attrs.dialog).filter((event) => last === null || new Date(event.createdAt).getTime() > last);

    if (tail.length && !this.attrs.state.hasPrev()) {
      items.push(
        <div className="MessageStream-item CanelaDialogEvents" key="canela-events-tail">
          {tail.map(DialogEventView)}
        </div>
      );
    }

    return items;
  });

  // O mapa vem logo depois da primeira mensagem da conversa.
  extend(STREAM as any, 'messageItem', function (this: any, vnode: any, message: any) {
    if (!messagesOn() || !vnode) return;

    const time = message.createdAt()?.getTime?.() ?? 0;
    const prev = this.canelaPrevTime as number | null;
    const before = dialogEvents(this.attrs.dialog).filter((event) => {
      const at = new Date(event.createdAt).getTime();
      return at <= time && (prev === null || at > prev);
    });

    this.canelaPrevTime = time;

    let children = Array.isArray(vnode.children) ? vnode.children : [vnode.children];

    if (before.length) children = [<div className="CanelaDialogEvents">{before.map(DialogEventView)}</div>, ...children];
    if (message.id() === this.attrs.dialog.messageRelationshipId('firstMessage')) children = [...children, DialogMap(this.attrs.dialog)];

    vnode.children = children;
  });
}

function installMessage(): void {
  // A barra de ações de uma postagem de mensagem: copiar o link e, em
  // destaque, "Responder" (a conversa toda; o flarum/messages não tem
  // resposta a uma mensagem específica).
  extend(MESSAGE as any, 'actionItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!messagesOn()) return;

    const message: DialogMessage = this.attrs.message;
    const dialog = message.dialog() as Dialog | false;

    if (!dialog) return;

    const copy = t('messages.topic.copy_link');

    items.add(
      'canelaShare',
      <Tooltip text={copy}>
        <Button
          className="Button Button--icon Button--link CanelaPostAction"
          icon="fas fa-link"
          aria-label={copy}
          onclick={() => shareLink(absoluteDialogUrl(dialog, message.number()), dialogTitle(dialog))}
        />
      </Tooltip>,
      50
    );

    if (dialog.canSendMessage() !== false) {
      items.add(
        'canelaReply',
        <Button
          className="Button Button--link CanelaPostAction CanelaPostAction--reply"
          icon="fas fa-reply"
          onclick={() => replyTo(dialog, this.attrs.state?.canelaStream)}
        >
          {t('messages.topic.reply')}
        </Button>,
        -100
      );
    }
  });

  // O escudo da equipe ao lado do nome (`.poster-icon` dos moderadores e
  // administradores do Discourse).
  extend(MESSAGE as any, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!messagesOn()) return;

    const user = this.attrs.message.user() as User | false;
    const groups = user ? ((user.groups() || []) as any[]).filter(Boolean) : [];
    const staff = groups.find((group) => group.id() === '1' || group.id() === '4');

    if (staff) {
      items.add(
        'canelaStaff',
        <Tooltip text={staff.nameSingular()}>
          <span className="CanelaStaffShield" aria-label={staff.nameSingular()}>
            <Icon name="fas fa-shield-halved" />
          </span>
        </Tooltip>,
        95
      );
    }
  });

  // A minha mensagem é a tingida (`.current-user-post`).
  extend(MESSAGE as any, 'classes', function (this: any, classes: string[]) {
    if (!messagesOn() || !Array.isArray(classes)) return;

    const user = this.attrs.message.user() as User | false;

    classes.push('CanelaMessagePost');
    if (user && user === app.session.user) classes.push('current-user-post');
  });
}

export default function installTopic(): void {
  installPage();
  installSection();
  installStream();
  installMessage();
}
