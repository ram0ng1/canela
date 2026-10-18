/*
 * As ações de mensagem no menu do composer (o `composer-actions` do
 * Discourse): ficam no pacote principal porque o composer de tópico e o de
 * resposta são do core. O resto da integração com o flarum/messages desce com
 * as telas dele (ver ui.ts).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';

import ComposerActionTitle from '../../composer/ComposerActionTitle';
import { t } from '../../utils/settings';
import { canSendMessages, lazyComponent, messagesOn, openMessageComposer } from './util';

const ICON_NEW = 'far fa-envelope';

/**
 * "Iniciar Discussão" no menu da mensagem nova: o Discourse troca o composer de
 * lugar levando o texto e o título. Aqui o composer de tópico abre com eles.
 */
function switchToTopic(): void {
  const fields: any = app.composer.fields;
  const content = fields?.content ? fields.content() : '';
  const title = fields?.canelaTitle ? fields.canelaTitle() : '';

  flarum.reg
    .asyncModuleImport('flarum/forum/components/ComposerBody')
    .then(() => app.composer.load(() => lazyComponent('flarum/forum/components/DiscussionComposer'), { user: app.session.user }))
    .then(() => {
      const next: any = app.composer.fields;
      if (content && next?.content) next.content(content);
      if (title && next?.title) next.title(title);
      app.composer.show();
    })
    .catch(() => {});
}

/**
 * "✉ Criar mensagem" no menu do composer de tópico (`composer-actions`): o
 * composer vira de mensagem levando o título e o texto — no lugar de
 * categoria | etiquetas entram os destinatários.
 */
function switchToMessage(): void {
  const fields: any = app.composer.fields;
  const content = fields?.content ? fields.content() : '';
  const title = fields?.title ? fields.title() : '';

  openMessageComposer()
    .then(() => {
      const next: any = app.composer.fields;
      if (content && next?.content) next.content(content);
      if (title && next?.canelaTitle) next.canelaTitle(title);
      m.redraw();
    })
    .catch(() => {});
}

/**
 * Abre a mensagem nova ao autor do tópico levando o texto já escrito e, no
 * começo, o link para o tópico (como o Discourse faz ao responder em privado).
 */
function replyAsMessage(discussion: any, author: User): void {
  const fields: any = app.composer.fields;
  const content = fields?.content ? fields.content() : '';
  const link = app.forum.attribute<string>('baseOrigin') + app.route.discussion(discussion);
  const body = `${link}\n\n${content}`.trim();

  openMessageComposer({ recipients: [author] })
    .then(() => {
      const next: any = app.composer.fields;
      if (next?.content) next.content(body);
      if (next?.canelaTitle) next.canelaTitle(discussion.title());
      m.redraw();
    })
    .catch(() => {});
}

export default function installComposerActions(): void {
  // O ponto de extensão do menu de ações do composer (`actionItems`): no
  // tópico novo, "Criar mensagem"; na mensagem nova, "Iniciar Discussão" levando
  // também o título (o do tema só leva o texto).
  extend(ComposerActionTitle.prototype as any, 'actionItems', function (this: any, items: ItemList<any>) {
    if (!messagesOn()) return;

    if (this.attrs.kind === 'new_topic' && canSendMessages()) {
      items.add(
        'message',
        {
          icon: ICON_NEW,
          label: t('messages.composer.action_new'),
          description: t('messages.composer.action_new_desc'),
          onclick: () => switchToMessage(),
        },
        80
      );
    }

    // "Responder como mensagem privada" (`reply_as_private_message`): uma
    // mensagem nova ao autor do tópico, com o link para ele.
    if (this.attrs.kind === 'reply' && this.attrs.discussion && canSendMessages()) {
      const discussion = this.attrs.discussion;
      const author = discussion.user();

      if (author && author !== app.session.user) {
        items.add(
          'replyAsMessage',
          {
            icon: ICON_NEW,
            label: t('messages.composer.reply_as_message'),
            description: t('messages.composer.reply_as_message_desc'),
            onclick: () => replyAsMessage(discussion, author),
          },
          70
        );
      }
    }

    if (this.attrs.kind === 'message' && items.has('newTopic')) {
      const action = items.get('newTopic');
      items.setContent('newTopic', { ...action, onclick: () => switchToTopic() });
    }
  });
}
