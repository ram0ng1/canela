/*
 * A página do tópico como um todo: as classes que ligam o layout de duas
 * colunas (stream | linha do tempo), o fim do tópico (botões + sugeridos), a
 * barra de novas respostas, o controle de notificações e o "↓ N não lidas"
 * na coluna da linha do tempo, e o destaque amarelado do post-alvo.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import NewRepliesBar from './components/NewRepliesBar';
import TopicEnd from './components/TopicEnd';
import TopicNotifications from './components/TopicNotifications';
import { canSubscribe, topicSettings } from './ui';
import { t } from '../utils/settings';

/** Quanto dura o destaque do post-alvo (o mesmo tempo da animação no LESS). */
const HIGHLIGHT_MS = 2500;

export default function installLayout(): void {
  extend(DiscussionPage.prototype, 'view', function (this: any, vnode: any) {
    if (!vnode || !vnode.attrs) return;

    vnode.attrs.className = classList(vnode.attrs.className, 'CanelaTopic', {
      'CanelaTopic--timeline': topicSettings.timeline(),
      'CanelaTopic--footer': topicSettings.footer(),
      'CanelaTopic--guest': !app.session.user,
    });

    if (!this.discussion || !this.stream) return;

    // O fim do tópico vai depois do PostStream, e não no endItems dele: lá
    // ficaria antes da caixa "Responder…", que o core põe por último — e que
    // precisa continuar a última, porque o stream rola até ela ao responder.
    const children: any[] = Array.isArray(vnode.children) ? vnode.children : [];
    const streamWrapper = children.find((child) => child && child.attrs && child.attrs.className === 'DiscussionPage-stream');

    if (!streamWrapper || !Array.isArray(streamWrapper.children)) return;

    streamWrapper.children.push(m(TopicEnd, { discussion: this.discussion, stream: this.stream, page: this }));

    if (topicSettings.newRepliesBar()) {
      streamWrapper.children.push(m(NewRepliesBar, { discussion: this.discussion, stream: this.stream, page: this }));
    }
  });

  extend(DiscussionPage.prototype, 'sidebarItems', function (this: any, items: ItemList<Mithril.Children>) {
    const discussion = this.discussion;

    if (!discussion || !topicSettings.timeline()) return;

    // O sino do Discourse no lugar do botão dividido do subscriptions.
    if (canSubscribe()) {
      if (items.has('subscription')) items.remove('subscription');

      items.add('canelaNotifications', <TopicNotifications discussion={discussion} compact />, 80);
    }

    const lastRead = discussion.lastReadPostNumber() || 0;
    const unread = discussion.unreadCount();

    if (app.session.user && lastRead > 0 && unread > 0) {
      items.add(
        'canelaUnread',
        <Button className="Button Button--flat CanelaTimeline-unread" icon="fas fa-arrow-down" onclick={() => this.stream?.goToNumber(lastRead + 1)}>
          {t('topic.timeline.unread', { count: unread })}
        </Button>,
        -110
      );
    }
  });

  // O destaque do Discourse: só quando o endereço aponta um post
  // (/d/x/N), e não o "pulso" do core a cada tópico aberto.
  override('flarum/forum/components/PostStream', 'flashItem', function (this: any, original: ($item: any) => void, $item: any) {
    const near = m.route.param('near');

    if (near === 'reply') return original($item);
    if (!near || !$item || !$item.length) return;

    const element: HTMLElement = $item[0];

    element.classList.remove('fadeIn', 'CanelaHighlight');
    // Força o reflow para a animação recomeçar num segundo clique no mesmo post.
    void element.offsetWidth;
    element.classList.add('CanelaHighlight');

    window.setTimeout(() => element.classList.remove('CanelaHighlight'), HIGHLIGHT_MS);
  });
}
