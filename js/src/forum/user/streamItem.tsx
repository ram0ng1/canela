/*
 * O item de atividade do perfil: avatar de 48px, o título do tópico como
 * link, categoria e data embaixo e o começo do texto. Usado pelas abas de
 * postagens do perfil (Postagens, Curtidas, Menções, Votos, Resolvido) e pela
 * aba Reações, que acrescenta a linha da reação (`extra`).
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import { truncate } from 'flarum/common/utils/string';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { discussionBadges } from '../utils/tags';
import { fullDate, mediumAge } from '../utils/dates';

/** O tamanho do trecho (o resumo do post). */
const STREAM_EXCERPT = 300;

export interface StreamItemOptions {
  className?: string;
  /** Entre o cabeçalho e o trecho (a reação da aba Reações). */
  extra?: Mithril.Children;
}

export default function streamItem(post: Post, options: StreamItemOptions = {}): Mithril.Children {
  const discussion = post.discussion() as Discussion | false;
  const user = post.user() as User | false;
  const createdAt = post.createdAt();

  return (
    <div className={classList('PostListItem CanelaStreamItem', options.className)}>
      <div className="CanelaStreamItem-header">
        {user ? (
          <Link href={app.route.user(user)} className="CanelaStreamItem-avatar" tabindex="-1" aria-hidden="true">
            <Avatar user={user} />
          </Link>
        ) : (
          <span className="CanelaStreamItem-avatar">
            <Avatar user={null} />
          </span>
        )}
        <div className="CanelaStreamItem-details">
          <div className="CanelaStreamItem-title">
            <Link href={app.route.post(post)}>{discussion ? discussion.title() : ''}</Link>
          </div>
          <div className="CanelaStreamItem-meta">
            {discussion && discussionBadges(discussion)}
            {createdAt && (
              <time className="CanelaStreamItem-date" datetime={createdAt.toISOString()} title={fullDate(createdAt)}>
                {mediumAge(createdAt)}
              </time>
            )}
          </div>
        </div>
      </div>
      {options.extra}
      <div className="CanelaStreamItem-excerpt">{truncate(post.contentPlain() || '', STREAM_EXCERPT)}</div>
    </div>
  );
}
