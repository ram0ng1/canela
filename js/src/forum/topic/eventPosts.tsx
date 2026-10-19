/*
 * Posts de evento (trancou, fixou, renomeou, convidou…) como a "small action"
 * do Discourse: numa linha só, o ícone pequeno num círculo, o avatar de quem
 * fez e o texto em cinza com o nome em negrito. O toggle `topic_event_posts`
 * do admin os oculta.
 */
import { extend } from 'flarum/common/extend';
import Avatar from 'flarum/common/components/Avatar';
import EventPost from 'flarum/forum/components/EventPost';
import type Mithril from 'mithril';

export default function installEventPosts(): void {
  extend(EventPost.prototype, 'content', function (this: EventPost, content: Mithril.Children[]) {
    const user = this.attrs.post.user();

    if (!user || !Array.isArray(content)) return;

    // Depois do ícone, antes do texto.
    const index = content.findIndex((child: any) => child?.attrs?.className === 'EventPost-info');

    content.splice(index === -1 ? content.length : index, 0, <Avatar user={user} className="EventPost-avatar" />);
  });
}
