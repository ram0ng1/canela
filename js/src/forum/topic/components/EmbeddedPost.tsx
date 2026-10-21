/*
 * Um post embutido dentro de outro: as
 * respostas que se abrem abaixo de um post, ou o post respondido que se abre
 * acima dele. O conteúdo é o HTML já renderizado pelo servidor; quando o post
 * veio só como relação (sem o HTML), quem embute busca antes de mostrar.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import username from 'flarum/common/helpers/username';
import classList from 'flarum/common/utils/classList';
import type Post from 'flarum/common/models/Post';

import { fullDate, shortAge } from '../../utils/dates';
import { t } from '../../utils/settings';
import { userIcons } from '../../utils/userIcons';

export interface EmbeddedPostAttrs extends ComponentAttrs {
  post: Post;
  /** Para onde aponta o link de ir ao post: acima (respondido) ou abaixo (resposta). */
  direction: 'up' | 'down';
  className?: string;
}

export default class EmbeddedPost extends Component<EmbeddedPostAttrs> {
  view() {
    const post = this.attrs.post;
    const user = post.user();
    const html = post.contentHtml();
    const time = post.createdAt();

    return (
      <article className={classList('CanelaEmbeddedPost', this.attrs.className)} data-number={post.number()}>
        <div className="CanelaEmbeddedPost-side">
          <Avatar user={user || null} />
        </div>
        <div className="CanelaEmbeddedPost-main">
          <header className="CanelaEmbeddedPost-header">
            <span className="CanelaEmbeddedPost-name">{username(user || null)}</span>
            {userIcons(user || null, 'embedded')}
            <Link className="CanelaEmbeddedPost-link" href={app.route.post(post)} title={t('topic.embedded.go_to_post')}>
              {time ? (
                <time dateTime={time.toISOString()} title={fullDate(time)}>
                  {shortAge(time)}
                </time>
              ) : null}
              <Icon name={this.attrs.direction === 'up' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'} />
            </Link>
          </header>
          <div className="CanelaEmbeddedPost-body">{html ? m.trust(html) : <p>{post.contentPlain() || ''}</p>}</div>
        </div>
      </article>
    );
  }
}

/** Busca, numa requisição só, os posts que vieram sem o HTML. */
export function loadMissingContent(posts: Post[]): Promise<unknown> {
  const missing = posts.filter((post) => !post.contentHtml()).map((post) => post.id()!);

  if (!missing.length) return Promise.resolve();

  return app.store.find('posts', { filter: { id: missing.join(',') } }, undefined, { errorHandler: () => {} });
}

export function embeddedLoading() {
  return <LoadingIndicator size="small" display="block" className="CanelaEmbeddedPost-loading" />;
}
