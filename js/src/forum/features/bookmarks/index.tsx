/*
 * Marcadores do Discourse.
 *
 * - Botão de marcador na barra de ações de cada post: marca direto; num post
 *   já marcado, abre o "Editar marcador" (nome, lembrete, excluir).
 * - "Marcar discussão" nos controles do tópico (o "…" do rodapé e o menu da
 *   página), que marca o primeiro post, como lá.
 * - Aba "Marcadores" no perfil (só o próprio) e item no menu do usuário.
 * - O tipo de notificação do lembrete nas preferências de notificação.
 *
 * A rota, o modelo e o componente da notificação ficam em ./extend (o
 * principal espalha aquele array no `extend` do fórum).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LinkButton from 'flarum/common/components/LinkButton';
import CommentPost from 'flarum/forum/components/CommentPost';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import UserPage from 'flarum/forum/components/UserPage';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { bookmarksEnabled, createBookmark, firstPostOf, isBusy, postBookmark } from './actions';
import { reminderLabel } from './reminders';
import { forumBool, t } from '../../utils/settings';

/** Entre o "copiar link" (-10) e o "…" (-50) da barra do tema, como no Discourse. */
const POST_ACTION_PRIORITY = -20;

export default function installBookmarks() {
  addPostButton();
  addTopicControl();
  addProfileTab();
  addSessionItem();
  addNotificationType();
}

/**
 * Num post sem marcador, marca e avisa — com o atalho "Definir lembrete" no
 * próprio aviso, já que o Discourse abre o menu de lembrete logo depois de
 * marcar. Num post marcado, abre o modal.
 */
export function togglePostBookmark(post: Post): void {
  if (isBusy(post)) return;

  if (postBookmark(post)) {
    app.modal.show(() => import('./components/BookmarkModal'), { post });
    return;
  }

  createBookmark(post)
    .then(() => {
      const alertId = app.alerts.show(
        {
          type: 'success',
          controls: [
            <Button
              className="Button Button--link"
              onclick={() => {
                app.alerts.dismiss(alertId);
                app.modal.show(() => import('./components/BookmarkModal'), { post });
              }}
            >
              {t('bookmarks.alerts.set_reminder')}
            </Button>,
          ],
        },
        t('bookmarks.alerts.added')
      );
    })
    .catch(() => {});
}

function buttonTitle(post: Post): string {
  const state = postBookmark(post);

  if (!state) return t('bookmarks.post.add');

  const parts = [state.name || t('bookmarks.post.edit')];

  if (state.reminderAt && state.reminderAt.getTime() > Date.now()) {
    parts.push(t('bookmarks.post.reminder', { date: reminderLabel(state.reminderAt) }));
  }

  return parts.join(' · ');
}

function addPostButton() {
  extend(CommentPost.prototype, 'actionItems', function (this: any, items: ItemList<Mithril.Children>) {
    const post: Post = this.attrs.post;

    if (!bookmarksEnabled() || post.isHidden()) return;

    const state = postBookmark(post);
    const hasReminder = !!state?.reminderAt && state.reminderAt.getTime() > Date.now();
    const label = buttonTitle(post);

    items.add(
      'canelaBookmark',
      <Button
        className={classList('Button Button--icon Button--flat CanelaPostAction CanelaBookmarkButton', {
          'CanelaBookmarkButton--active': !!state,
          'CanelaBookmarkButton--reminder': hasReminder,
        })}
        icon={state ? 'fas fa-bookmark' : 'far fa-bookmark'}
        aria-label={label}
        aria-pressed={state ? 'true' : 'false'}
        title={label}
        disabled={isBusy(post)}
        onclick={() => togglePostBookmark(post)}
      >
        {hasReminder && <Icon name="fas fa-clock" className="CanelaBookmarkButton-clock" />}
      </Button>,
      POST_ACTION_PRIORITY
    );
  });
}

/** Marca (ou edita) o primeiro post do tópico. */
export async function toggleTopicBookmark(discussion: Discussion): Promise<void> {
  const post = await firstPostOf(discussion);

  if (!post) return;

  togglePostBookmark(post);
  m.redraw();
}

export function topicIsBookmarked(discussion: Discussion): boolean {
  const linkedId = (discussion.data.relationships as any)?.firstPost?.data?.id;
  const firstPost =
    (linkedId && app.store.getById<Post>('posts', linkedId)) ||
    app.store.all<Post>('posts').find((post) => post.discussion() === discussion && post.number() === 1);

  return !!firstPost && !!postBookmark(firstPost);
}

function addTopicControl() {
  extend(DiscussionControls, 'userControls', function (items: ItemList<Mithril.Children>, discussion: Discussion) {
    if (!bookmarksEnabled() || !forumBool('canelaBookmarksTopicButton', true)) return;

    const bookmarked = topicIsBookmarked(discussion);

    items.add(
      'canelaBookmark',
      <Button icon={bookmarked ? 'fas fa-bookmark' : 'far fa-bookmark'} onclick={() => toggleTopicBookmark(discussion).catch(() => {})}>
        {t(bookmarked ? 'bookmarks.topic.edit' : 'bookmarks.topic.add')}
      </Button>,
      // Logo abaixo do "Responder" (sem prioridade, fica no topo da lista).
      -10
    );
  });
}

function addProfileTab() {
  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    // Marcadores são pessoais: a aba só aparece no próprio perfil.
    if (!this.user || !bookmarksEnabled() || app.session.user !== this.user) return;

    items.add(
      'canelaBookmarks',
      <LinkButton href={app.route('canela.user.bookmarks', { username: this.user.slug() })} icon="far fa-bookmark">
        {t('bookmarks.page.nav')}
      </LinkButton>,
      75
    );
  });
}

function addSessionItem() {
  extend(SessionDropdown.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    const user = app.session.user;

    if (!user || !bookmarksEnabled() || !forumBool('canelaBookmarksUserMenu', true)) return;

    items.add(
      'canelaBookmarks',
      <LinkButton icon="far fa-bookmark" href={app.route('canela.user.bookmarks', { username: user.slug() })}>
        {t('bookmarks.page.nav')}
      </LinkButton>,
      // Logo abaixo de "Perfil" (100) e acima de "Configurações" (50).
      90
    );
  });
}

function addNotificationType() {
  // Pelo nome do módulo: o NotificationGrid vem no pedaço da página de
  // configurações, carregado sob demanda — no boot a classe ainda não existe.
  extend('flarum/forum/components/NotificationGrid' as any, 'notificationTypes', function (items: ItemList<any>) {
    if (!forumBool('canelaBookmarksEnabled', false)) return;

    items.add('canelaBookmarkReminder', {
      name: 'canelaBookmarkReminder',
      icon: 'fas fa-bookmark',
      label: t('bookmarks.settings.notify_reminder_label'),
    });
  });
}
