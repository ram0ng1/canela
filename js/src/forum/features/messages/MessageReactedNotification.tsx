/*
 * "Fulano reagiu à sua mensagem" (tipo `canelaMessageReacted`): leva à
 * mensagem na conversa; o trecho é o começo dela.
 */
import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import { truncate } from 'flarum/common/utils/string';

import { t } from '../../utils/settings';
import { dialogHref, type Dialog, type DialogMessage } from './util';

export default class MessageReactedNotification extends Notification {
  icon() {
    return 'far fa-face-smile';
  }

  message(): DialogMessage | null {
    return (this.attrs.notification.subject() as unknown as DialogMessage | null | false) || null;
  }

  href() {
    const message = this.message();
    const dialog = message?.dialog() as Dialog | false | undefined;

    return dialog ? dialogHref(dialog, message!.number()) : app.route('messages');
  }

  content() {
    const user = this.attrs.notification.fromUser();

    return t('messages.reactions.notification', { username: user ? user.displayName() : '' });
  }

  excerpt() {
    const plain = this.message()?.contentPlain();

    return plain ? truncate(plain, 200) : null;
  }
}
