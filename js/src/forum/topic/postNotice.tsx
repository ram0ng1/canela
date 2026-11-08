/*
 * Avisos de post, como no Discourse: uma faixa acima do texto dizendo que é a
 * primeira postagem da pessoa ("dê as boas-vindas") ou que ela voltou depois
 * de muito tempo ("a última postagem foi há 7 meses"). O servidor decide e
 * grava o aviso quando o post nasce (Ramon\Canela\Topic\PostNotice) e manda
 * `canelaNotice` = `{type, since}`.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';
import Comment from 'flarum/forum/components/Comment';
import Icon from 'flarum/common/components/Icon';
import username from 'flarum/common/helpers/username';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { fullDate } from '../utils/dates';

interface PostNotice {
  type: 'first' | 'returning';
  since: string | null;
}

export default function installPostNotice(): void {
  extend(CommentPost.prototype, 'content', function (this: any, content: Mithril.Children[]) {
    const post = this.attrs.post as Post;
    const notice = post.attribute<PostNotice | null>('canelaNotice');

    if (!notice || post.isHidden() || this.isEditing?.()) return;

    const name = username(post.user());
    const since = notice.since ? new Date(notice.since) : null;
    const returning = notice.type === 'returning' && since;

    // Vai junto com o corpo (o Comment do core), que o põe logo abaixo do
    // cabeçalho (nome e data) e antes do texto.
    const comment = content.find((child: any) => child?.tag === Comment) as any;

    if (comment)
      comment.attrs.canelaNotice = (
        <div className={`CanelaPostNotice CanelaPostNotice--${returning ? 'returning' : 'first'}`} title={since ? fullDate(since) : undefined}>
          <Icon name={returning ? 'fas fa-clock-rotate-left' : 'fas fa-hand'} />
          <span>
            {returning
              ? app.translator.trans('ramon-canela.forum.topic.post.notice_returning', { username: name, ago: dayjs(since).fromNow() })
              : app.translator.trans('ramon-canela.forum.topic.post.notice_first', { username: name })}
          </span>
        </div>
      );
  });

  extend(Comment.prototype, 'view', function (this: any, children: Mithril.Children[]) {
    if (this.attrs.canelaNotice && Array.isArray(children)) children.splice(1, 0, this.attrs.canelaNotice);
  });
}
