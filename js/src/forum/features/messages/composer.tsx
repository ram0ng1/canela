/*
 * O composer de mensagem do flarum/messages na forma de um composer de
 * mensagem pessoal, dentro da mesma casca
 * do composer do tema (`composer/installComposerShell.tsx`):
 *
 *   alça · "✉ Criar mensagem ▾" ...................... «  ⤢  —  ✕
 *   [👤 ana ✕] Adicionar usuários(as) ou grupos ▾ |
 *   Título
 *   texto                                  | prévia
 *   B I H 🔗 " </> … ................ Descartar  [Enviar mensagem]
 *
 * Na resposta, só a ação ("↪ Mensagem") e o link para a mensagem quando ela
 * não está aberta atrás do composer.
 *
 * A casca já cuida do rodapé (Descartar + botão primário sem ícone), dos
 * botões do canto, da prévia ao lado e das alturas; aqui entram só os campos
 * do cabeçalho e os rótulos. O MessageComposer vem num pedaço carregado sob
 * demanda: é estendido pelo nome do módulo.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import Stream from 'flarum/common/utils/Stream';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import RecipientChooser from './RecipientChooser';
import ComposerActionTitle from '../../composer/ComposerActionTitle';
import { isExtensionEnabled, t } from '../../utils/settings';
import { boxesOn, dialogHref, dialogTitle, messageGroup, messagesOn, type Dialog } from './util';

const COMPOSER = 'ext:flarum/messages/forum/components/MessageComposer';

/** O máximo de destinatários por mensagem (o backend confere). */
const MAX_RECIPIENTS = 30;

/** Os ícones das ações (envelope e compartilhar). */
const ICON_NEW = 'far fa-envelope';
const ICON_REPLY = 'fas fa-arrow-up-from-bracket';

/**
 * O placeholder do composer de tópico do tema (dizendo só o
 * que este fórum faz) — a mesma regra de `composer/installComposerShell.tsx`,
 * que não a exporta.
 */
function bodyPlaceholder(): string {
  const markdown = isExtensionEnabled('flarum-markdown');
  const upload = isExtensionEnabled('fof-upload') && !!app.forum.attribute('fof-upload.canUpload');
  const key = markdown
    ? upload
      ? 'body_placeholder_markdown_upload'
      : 'body_placeholder_markdown'
    : upload
      ? 'body_placeholder_upload'
      : 'body_placeholder';

  return t(`composer.shell.${key}`);
}

interface MessageActionAttrs extends ComponentAttrs {
  dialog?: Dialog;
  title: () => string;
  recipients: () => User[];
}

/**
 * A primeira linha (`.reply-to`): "✉ Criar mensagem ▾" na mensagem nova, com
 * o menu de ações (trocar por um tópico), e "↪ Mensagem" na
 * resposta. Minimizado, vira a barra do rascunho.
 */
class MessageAction extends Component<MessageActionAttrs> {
  view(): Mithril.Children {
    const { dialog } = this.attrs;

    if (app.composer.position === 'minimized') {
      const text = dialog ? dialogTitle(dialog) : this.attrs.title() || this.attrs.recipients()[0]?.username() || t('messages.composer.action_new');

      return (
        <div className="CanelaComposerAction CanelaComposerAction--draft">
          <Icon name={dialog ? ICON_REPLY : ICON_NEW} />
          <span className="CanelaComposerAction-draftText">{text}</span>
        </div>
      );
    }

    // A mensagem nova usa o mesmo cabeçalho do composer de tópico (com o
    // menu de ações dele); a resposta tem o rótulo parado e o link.
    if (!dialog) return <ComposerActionTitle kind="message" label={t('messages.composer.action_new')} icon={ICON_NEW} title={this.attrs.title} />;

    return (
      <div className="CanelaComposerAction" role="heading" aria-level={1}>
        {this.replyTrigger()}
        {this.targetLink(dialog)}
      </div>
    );
  }

  replyTrigger(): Mithril.Children {
    return (
      <span className="CanelaComposerAction-trigger CanelaComposerAction-trigger--static">
        <Icon name={ICON_REPLY} />
        <span className="CanelaComposerAction-label">{t('messages.composer.action_reply')}</span>
      </span>
    );
  }

  /** "🔗 título": só quando a mensagem não está aberta atrás do composer. */
  targetLink(dialog: Dialog): Mithril.Children {
    if (m.route.param('id') === dialog.id()) return null;

    const title = dialogTitle(dialog);

    return (
      <Link
        className="CanelaComposerAction-target"
        href={dialogHref(dialog)}
        title={title}
        onclick={(event: MouseEvent) => {
          if (app.composer.position === 'fullScreen') {
            app.composer.minimize();
            event.stopPropagation();
          }
        }}
      >
        <Icon name="fas fa-link" />
        <span className="CanelaComposerAction-targetLabel">{title}</span>
      </Link>
    );
  }
}

export default function installComposer(): void {
  flarum.reg.onLoad('flarum-messages', 'forum/components/MessageComposer', (module: any) => {
    // "Enviar mensagem" / "Responder" e o placeholder do editor do tema.
    override(module, 'initAttrs', function (this: any, original: (attrs: any) => void, attrs: any) {
      if (messagesOn()) {
        attrs.submitLabel = attrs.submitLabel || (attrs.replyingTo ? t('messages.composer.submit_reply') : t('messages.composer.submit'));
        attrs.placeholder = attrs.placeholder || bodyPlaceholder();
      }

      return original(attrs);
    });
  });

  extend(COMPOSER as any, 'oninit', function (this: any) {
    const fields = this.composer?.fields;

    if (fields && !fields.canelaTitle) fields.canelaTitle = Stream('');
    if (fields && !fields.canelaGroup) fields.canelaGroup = Stream<number | null>(null);
  });

  extend(COMPOSER as any, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!messagesOn()) return;

    const dialog: Dialog | undefined = this.attrs.replyingTo;
    const fields = this.composer.fields;

    const put = (key: string, content: Mithril.Children, priority: number) => {
      if (items.has(key)) items.setContent(key, content).setPriority(key, priority);
      else items.add(key, content, priority);
    };

    put(
      'title',
      <MessageAction dialog={dialog} title={() => (fields.canelaTitle ? fields.canelaTitle() : '')} recipients={() => this.recipients()} />,
      1000
    );

    if (dialog) {
      // Na resposta os destinatários são os da conversa: nada a escolher.
      if (items.has('recipients')) items.remove('recipients');
      return;
    }

    put(
      'recipients',
      <div className="CanelaComposerFields CanelaMessageFields">
        <RecipientChooser
          recipients={this.recipients}
          max={boxesOn() ? MAX_RECIPIENTS : 1}
          group={messageGroup() ? fields.canelaGroup : undefined}
          groupContact
        />
        {/* A metade direita fica vazia (a das etiquetas, sem etiquetas em mensagem), com o traço no meio. */}
        <div className="CanelaComposerFields-cell CanelaMessageFields-rest" aria-hidden="true" />
      </div>,
      500
    );

    // O título só é guardado com o backend do tema (a coluna é dele).
    if (boxesOn()) {
      put(
        'canelaMessageTitle',
        <h3>
          <input
            className="FormControl CanelaMessageTitle-input"
            type="text"
            value={fields.canelaTitle()}
            maxlength={255}
            placeholder={t('messages.composer.title_placeholder')}
            aria-label={t('messages.composer.title_placeholder')}
            oninput={(event: InputEvent) => fields.canelaTitle((event.target as HTMLInputElement).value)}
            onkeydown={(event: KeyboardEvent) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                document.querySelector<HTMLTextAreaElement>('.Composer .TextEditor-editor')?.focus();
              }
            }}
          />
        </h3>,
        400
      );
    }
  });

  extend(COMPOSER as any, 'data', function (this: any, data: Record<string, any>) {
    if (!messagesOn() || this.attrs.replyingTo || !boxesOn() || !data) return;

    // A API aceita um destinatário em `users`; os outros vão em `canelaUsers`
    // e o tema abre uma conversa nova com todos.
    const recipients: User[] = this.recipients();

    if (recipients.length > 1) {
      data.users = [{ id: recipients[0].id() }];
      data.canelaUsers = recipients.slice(1).map((user) => Number(user.id()));
    }

    // "Mensagem à equipe": o grupo escolhido no seletor. O contato da equipe vai
    // em `users` só porque a API pede alguém; sem isto a conversa fica a dois.
    if (this.composer.fields.canelaGroup?.()) data.canelaToGroup = true;

    const title = String(this.composer.fields.canelaTitle?.() || '').trim();

    if (title) data.canelaTitle = title;
  });

  // Mensagem sem destinatário não sai: o envio fica desabilitado.
  override(COMPOSER as any, 'onsubmit', function (this: any, original: () => void) {
    if (messagesOn() && !this.attrs.replyingTo && !this.recipients().length) {
      app.alerts.show({ type: 'error' }, t('messages.composer.recipients_missing'));
      document.querySelector<HTMLInputElement>('.Composer .CanelaRecipients-input')?.focus();
      return;
    }

    return original();
  });
}
