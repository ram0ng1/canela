/*
 * Os botões do fim do tópico, como o #topic-footer-buttons do Discourse:
 * pílulas com borda, ícone e texto — Compartilhar, Favorito, Sinalizar,
 * Marcar não lido — e "Responder" em destaque; o "…" com o que sobra dos
 * controles do tópico (renomear, apagar, imprimir…). Na linha de baixo, o
 * controle de notificações e o texto do nível ("Você será notificado(a)…").
 * O visitante só tem o "Responder".
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';

import TopicNotifications, { notificationReason } from './TopicNotifications';
import { canSubscribe } from '../ui';
import { isExtensionEnabled, t } from '../../utils/settings';
import { openShare } from '../../gaps/topic/share';
import { bookmarksEnabled } from '../../features/bookmarks/actions';
import { toggleTopicBookmark, topicIsBookmarked } from '../../features/bookmarks/index';

export interface TopicFooterAttrs extends ComponentAttrs {
  discussion: Discussion;
  /** A DiscussionPage: os controles do tópico mudam conforme o contexto. */
  page: any;
}

/** O primeiro post, se já está no store (o fim do tópico quase sempre o tem). */
function firstPost(discussion: Discussion): Post | null {
  const linkedId = (discussion.data.relationships as any)?.firstPost?.data?.id;

  return (
    (linkedId && app.store.getById<Post>('posts', linkedId)) ||
    app.store.all<Post>('posts').find((post) => post.discussion() === discussion && post.number() === 1) ||
    null
  );
}

export default class TopicFooter extends Component<TopicFooterAttrs> {
  markingUnread = false;

  view() {
    const discussion = this.attrs.discussion;

    // O visitante só tem o "Responder", à direita (que abre a janela de entrar).
    if (!app.session.user) {
      return (
        <div className="CanelaTopicFooter CanelaTopicFooter--guest" role="group" aria-label={t('topic.footer.aria_label')}>
          <div className="CanelaTopicFooter-main">{this.replyButton(discussion)}</div>
        </div>
      );
    }

    // O que já tem botão próprio não se repete no "…".
    const controls = DiscussionControls.controls(discussion, this.attrs.page);
    ['reply', 'canelaBookmark'].forEach((key) => controls.has(key) && controls.remove(key));
    const controlItems = controls.toArray().filter((item: any) => item && item.itemName && !/Separator$/.test(item.itemName));

    return (
      <div className="CanelaTopicFooter" role="group" aria-label={t('topic.footer.aria_label')}>
        <div className="CanelaTopicFooter-main">
          <Button
            className="Button CanelaTopicFooter-button CanelaTopicFooter-share"
            icon="fas fa-arrow-up-from-bracket"
            onclick={() => openShare(discussion)}
          >
            {t('topic.footer.share')}
          </Button>

          {this.bookmarkButton(discussion)}
          {this.flagButton(discussion)}
          {this.unreadButton(discussion)}

          {controlItems.length > 0 && (
            <Dropdown
              className="CanelaTopicFooter-more"
              buttonClassName="Button Button--icon CanelaTopicFooter-button"
              menuClassName="Dropdown-menu--right"
              icon="fas fa-ellipsis-h"
              caretIcon=""
              label=""
              helperText={null}
              accessibleToggleLabel={t('topic.footer.more')}
            >
              {controls.toArray()}
            </Dropdown>
          )}

          {this.replyButton(discussion)}
        </div>

        {canSubscribe() && (
          <div className="CanelaTopicFooter-notifications">
            <TopicNotifications discussion={discussion} />
            <p className="CanelaTopicFooter-reason">{notificationReason(discussion)}</p>
          </div>
        )}
      </div>
    );
  }

  /** Favorito = o marcador do primeiro post (o "bookmark" de tópico do Discourse). */
  bookmarkButton(discussion: Discussion) {
    if (!bookmarksEnabled()) return null;

    const bookmarked = topicIsBookmarked(discussion);

    return (
      <Button
        className={classNames('Button CanelaTopicFooter-button CanelaTopicFooter-bookmark', bookmarked && 'CanelaTopicFooter-button--active')}
        icon={bookmarked ? 'fas fa-bookmark' : 'far fa-bookmark'}
        onclick={() => toggleTopicBookmark(discussion).catch(() => {})}
      >
        {t(bookmarked ? 'topic.footer.bookmarked' : 'topic.footer.bookmark')}
      </Button>
    );
  }

  /** Sinalizar o tópico = sinalizar o primeiro post, com o modal do flarum/flags. */
  flagButton(discussion: Discussion) {
    if (!isExtensionEnabled('flarum-flags')) return null;

    const post = firstPost(discussion);

    if (!post || post.isHidden() || !post.attribute('canFlag')) return null;

    return (
      <Button
        className="Button CanelaTopicFooter-button CanelaTopicFooter-flag"
        icon="far fa-flag"
        onclick={() => app.modal.show(() => flarum.reg.asyncModuleImport('ext:flarum/flags/forum/components/FlagPostModal'), { post })}
      >
        {t('topic.footer.flag')}
      </Button>
    );
  }

  /**
   * "Marcar não lido": a leitura volta para antes do último post lido e a
   * pessoa volta para a lista, como no Discourse. Precisa do campo do tema
   * (extend/topic.php): o core só deixa a leitura andar para a frente.
   */
  unreadButton(discussion: Discussion) {
    const lastRead = discussion.lastReadPostNumber() || 0;

    if (!app.forum.attribute('canelaMarkUnread') || lastRead < 1) return null;

    return (
      <Button
        className="Button CanelaTopicFooter-button CanelaTopicFooter-unread"
        icon="fas fa-circle"
        loading={this.markingUnread}
        onclick={() => {
          this.markingUnread = true;

          discussion
            .save({ canelaMarkUnread: lastRead - 1 } as any)
            .then(() => {
              discussion.pushAttributes({ lastReadPostNumber: lastRead - 1 });
              m.route.set(app.route('index'));
            })
            .catch(() => {})
            .finally(() => {
              this.markingUnread = false;
              m.redraw();
            });
        }}
      >
        {t('topic.footer.mark_unread')}
      </Button>
    );
  }

  replyButton(discussion: Discussion) {
    if (app.session.user && !discussion.canReply()) {
      return (
        <Button className="Button CanelaTopicFooter-reply disabled" icon="fas fa-reply" disabled>
          {app.translator.trans('core.forum.discussion_controls.cannot_reply_button')}
        </Button>
      );
    }

    return (
      <Button
        className="Button Button--primary CanelaTopicFooter-reply"
        icon="fas fa-reply"
        onclick={() => DiscussionControls.replyAction.call(discussion, true, false).catch(() => {})}
      >
        {t('topic.footer.reply')}
      </Button>
    );
  }
}

function classNames(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
