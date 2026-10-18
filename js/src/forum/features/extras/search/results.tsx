/*
 * Os resultados da página de busca, como no Discourse: avatar à esquerda,
 * título grande, categoria e etiquetas, e "data - trecho" com as palavras
 * pesquisadas em negrito.
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import highlight from 'flarum/common/helpers/highlight';
import username from 'flarum/common/helpers/username';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { shortDate } from '../../../utils/dates';
import { categoryBadge, discussionBadges, labelBadge, type CanelaTag } from '../../../utils/tags';
import { isCategory } from './query';

/** Tamanho do trecho, em caracteres — o do Discourse (`blurb`). */
const BLURB_LENGTH = 220;

function avatarLink(user: User | null | false | undefined): Mithril.Children {
  return (
    <div className="CanelaSearchResult-avatar">
      {user ? (
        <Link href={app.route.user(user)} aria-label={user.displayName()} tabindex="-1">
          <Avatar user={user} title="" />
        </Link>
      ) : (
        <Avatar user={null} title="" />
      )}
    </div>
  );
}

function blurb(post: Post | null | false | undefined, pattern: RegExp | undefined): Mithril.Children {
  if (!post) return null;

  const text = (post.contentPlain() || '').replace(/\s+/g, ' ').trim();
  const date = post.createdAt();

  return (
    <div className="CanelaSearchResult-blurb">
      {date && <span className="CanelaSearchResult-date">{shortDate(date)}</span>}
      {date && text ? ' - ' : null}
      {text ? highlight(text, pattern, BLURB_LENGTH) : null}
    </div>
  );
}

export function discussionResult(discussion: Discussion, pattern: RegExp | undefined): Mithril.Children {
  // Com texto, o trecho é o da postagem que mais casou; sem texto (só
  // filtros), o da abertura do tópico.
  const post = discussion.mostRelevantPost() || discussion.firstPost();
  const user = (post && post.user()) || discussion.user();
  const statusBadges = discussion.badges().toArray();
  const near = post && post.number() > 1 ? post.number() : undefined;

  return (
    <li className="CanelaSearchResult" key={`d${discussion.id()}`} data-id={discussion.id()}>
      {avatarLink(user)}
      <div className="CanelaSearchResult-main">
        <div className="CanelaSearchResult-titleLine">
          {statusBadges.length > 0 && <span className="CanelaSearchResult-status">{statusBadges}</span>}
          <Link className="CanelaSearchResult-title" href={app.route.discussion(discussion, near)}>
            {highlight(discussion.title(), pattern)}
          </Link>
        </div>
        <div className="CanelaSearchResult-meta">{discussionBadges(discussion)}</div>
        {blurb(post, pattern)}
      </div>
    </li>
  );
}

export function postResult(post: Post, pattern: RegExp | undefined): Mithril.Children {
  const discussion = post.discussion();

  if (!discussion) return null;

  return (
    <li className="CanelaSearchResult CanelaSearchResult--post" key={`p${post.id()}`} data-id={post.id()}>
      {avatarLink(post.user())}
      <div className="CanelaSearchResult-main">
        <div className="CanelaSearchResult-titleLine">
          <Link className="CanelaSearchResult-title" href={app.route.post(post)}>
            {highlight(discussion.title(), pattern)}
          </Link>
          {post.number() > 1 && <span className="CanelaSearchResult-number">#{post.number()}</span>}
        </div>
        <div className="CanelaSearchResult-meta">
          {discussionBadges(discussion)}
          <span className="CanelaSearchResult-author">{username(post.user())}</span>
        </div>
        {blurb(post, pattern)}
      </div>
    </li>
  );
}

export function tagResult(tag: CanelaTag, pattern: RegExp | undefined): Mithril.Children {
  const description = tag.description();

  return (
    <li className="CanelaSearchResult CanelaSearchResult--tag" key={`t${tag.id()}`}>
      <div className="CanelaSearchResult-main">
        <div className="CanelaSearchResult-titleLine">{isCategory(tag) ? categoryBadge(tag) : labelBadge(tag)}</div>
        {description && <div className="CanelaSearchResult-blurb">{highlight(description, pattern, BLURB_LENGTH)}</div>}
      </div>
      <div className="CanelaSearchResult-count">{tag.discussionCount()}</div>
    </li>
  );
}

export function userResult(user: User, pattern: RegExp | undefined): Mithril.Children {
  const name = user.displayName();
  const handle = user.username();

  return (
    <li className="CanelaSearchResult CanelaSearchResult--user" key={`u${user.id()}`}>
      {avatarLink(user)}
      <div className="CanelaSearchResult-main">
        <div className="CanelaSearchResult-titleLine">
          <Link className="CanelaSearchResult-title" href={app.route.user(user)}>
            {highlight(name, pattern)}
          </Link>
          {handle !== name && <span className="CanelaSearchResult-handle">@{highlight(handle, pattern)}</span>}
        </div>
      </div>
    </li>
  );
}
