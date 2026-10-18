/*
 * A fila de revisão do Discourse (/review) sobre o flarum/flags: cada post
 * com sinalizações abertas vira um `.reviewable-item` — o tipo, o tópico com
 * a categoria, o post inteiro, quem sinalizou e por quê, e as ações.
 *
 * O flarum/flags não guarda histórico (resolver = apagar as sinalizações), então
 * não há o filtro de status do Discourse; o filtro é pelo tipo do item. As
 * postagens que o flarum/approval segura chegam pela mesma lista (ele cria
 * uma sinalização do tipo `approval`) e viram "Postagem na fila".
 *
 * A lista é carregada aqui, e não pelo `app.flags`, porque o item precisa do
 * post inteiro com todas as sinalizações e as etiquetas do tópico: o
 * `FlagListState` só pede o post e o autor.
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import extractText from 'flarum/common/utils/extractText';
import username from 'flarum/common/helpers/username';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { discussionBadges, isTagsEnabled } from '../utils/tags';
import { fullDate, shortAge } from '../utils/dates';
import { isExtensionEnabled, t } from '../utils/settings';
// As denúncias do chat (ramon/chat) entram na mesma fila: thirdparty/ramonChat/features.
import { chatReviewOn } from '../thirdparty/ramonChat/features/flags';
import { chatReportItem } from '../thirdparty/ramonChat/features/reviewChat';
import { loadChatReports, type ChatReport } from '../thirdparty/ramonChat/features/reviewData';

/** Tudo o que o item mostra, numa requisição só. */
const INCLUDE = ['user', 'post', 'post.user', 'post.discussion', 'post.discussion.tags', 'post.flags', 'post.flags.user'];

/** Acima disso o post começa recolhido, como o `.post-body.is-collapsed` do Discourse. */
const COLLAPSE_AT = 600;

type ReviewFilter = 'all' | 'flagged' | 'queued' | 'chat';

/** Os motivos do flarum/flags com os nomes das sinalizações do Discourse. */
const REASONS: Record<string, string> = {
  off_topic: 'review.reason_off_topic',
  inappropriate: 'review.reason_inappropriate',
  spam: 'review.reason_spam',
  other: 'review.reason_other',
};

function rt(key: string, params: Record<string, unknown> = {}): string {
  return t(`review.${key}`, params);
}

function postFlags(post: Post): any[] {
  return ((post as any).flags?.() || []).filter(Boolean);
}

/** Na fila do flarum/approval: a sinalização dele, ou o post ainda não aprovado. */
function isQueued(post: Post): boolean {
  return (post as any).isApproved?.() === false || postFlags(post).some((flag) => flag.type() === 'approval');
}

function reasonLabel(flag: any): string {
  const reason = flag.reason?.() || '';

  if (REASONS[reason]) return t(REASONS[reason]);
  if (reason) return extractText(app.translator.trans(`flarum-flags.forum.flag_post.reason_${reason}_label`));

  return t('review.reason_other');
}

function reasonIcon(flag: any): string {
  switch (flag.reason?.()) {
    case 'off_topic':
      return 'fas fa-comment-slash';
    case 'spam':
      return 'fas fa-ban';
    case 'inappropriate':
      return 'fas fa-triangle-exclamation';
    default:
      return 'fas fa-flag';
  }
}

export default class ReviewQueue extends Component {
  /** Uma sinalização por post (a API agrupa por post); o post traz todas. */
  posts: Post[] = [];
  loading = true;
  loadingMore = false;
  hasMore = false;
  offset = 0;
  filter: ReviewFilter = 'all';
  busy = new Set<string>();
  expanded = new Set<string>();
  /** As mensagens do chat denunciadas (uma entrada por mensagem). */
  chatReports: ChatReport[] = [];
  chatLoading = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    const param = String(m.route.param('type') || '');
    if (param === 'flagged' || param === 'queued' || (param === 'chat' && chatReviewOn())) this.filter = param as ReviewFilter;

    this.load();
    this.loadChat();
  }

  loadChat(): void {
    if (!chatReviewOn()) return;

    this.chatLoading = true;

    loadChatReports()
      .then((reports) => (this.chatReports = reports))
      .catch(() => {})
      .then(() => {
        this.chatLoading = false;
        m.redraw();
      });
  }

  /** Quando o post entrou na fila: a sinalização mais nova, ou o próprio post (na aprovação). */
  postDate(post: Post): number {
    if (isQueued(post)) return post.createdAt()?.getTime() || 0;

    return Math.max(
      0,
      ...postFlags(post)
        .filter((flag) => flag.type() !== 'approval')
        .map((flag) => flag.createdAt()?.getTime() || 0)
    );
  }

  /** Posts e mensagens do chat juntos, do mais recente ao mais antigo. */
  entries(): Mithril.Children[] {
    const items: { date: number; render: () => Mithril.Children }[] = [];

    if (this.filter !== 'chat') {
      this.visiblePosts().forEach((post) => items.push({ date: this.postDate(post), render: () => this.item(post) }));
    }

    if (this.filter !== 'queued') {
      this.chatReports.forEach((report) =>
        items.push({
          date: report.date.getTime(),
          render: () =>
            chatReportItem(report, {
              busy: this.busy,
              onResolved: (done) => (this.chatReports = this.chatReports.filter((entry) => entry !== done)),
            }),
        })
      );
    }

    return items.sort((a, b) => b.date - a.date).map((entry) => entry.render());
  }

  load(more = false): void {
    // Quem só modera o chat não vê as sinalizações de posts (a API recusaria).
    if (!app.forum.attribute<boolean>('canViewFlags')) {
      this.loading = false;
      return;
    }

    if (more) this.loadingMore = true;

    app.store
      .find<any[]>('flags', { include: INCLUDE.join(','), page: { offset: this.offset } } as any)
      .then((results: any) => {
        const seen = new Set(this.posts.map((post) => post.id()));

        Array.from(results as any[]).forEach((flag: any) => {
          const post = flag.post?.() as Post | false;

          if (post && !seen.has(post.id())) {
            seen.add(post.id());
            this.posts.push(post);
          }
        });

        this.offset += Array.from(results as any[]).length;
        this.hasMore = !!results.payload?.links?.next;

        // A API marcou tudo como visto (`read_flags_at`): a bolha do menu zera.
        app.session.user?.pushAttributes({ newFlagCount: 0 });
      })
      .catch(() => {})
      .then(() => {
        this.loading = false;
        this.loadingMore = false;
        m.redraw();
      });
  }

  visiblePosts(): Post[] {
    if (this.filter === 'all') return this.posts;

    return this.posts.filter((post) => (this.filter === 'queued' ? isQueued(post) : !isQueued(post)));
  }

  view() {
    const entries = this.entries();

    return (
      <div className="CanelaReview reviewable">
        <div className="CanelaReview-header">
          <h2 className="CanelaReview-title">{rt('title')}</h2>
          {this.filters()}
        </div>
        {this.loading || (this.chatLoading && !entries.length) ? (
          <LoadingIndicator />
        ) : entries.length ? (
          <div className="reviewables">{entries}</div>
        ) : (
          <div className="CanelaReview-empty no-review">{rt('empty')}</div>
        )}
        {this.hasMore && !this.loading ? (
          <div className="CanelaReview-more">
            <Button className="Button" loading={this.loadingMore} onclick={() => this.load(true)}>
              {rt('load_more')}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  filters(): Mithril.Children {
    const options: { key: ReviewFilter; label: string }[] = [
      { key: 'all', label: rt('filter_all') },
      { key: 'flagged', label: rt('filter_flagged') },
    ];

    if (isExtensionEnabled('flarum-approval')) options.push({ key: 'queued', label: rt('filter_queued') });
    if (chatReviewOn() && (this.chatReports.length || this.filter === 'chat'))
      options.push({ key: 'chat', label: t('ramon_chat.review.filter_chat') });

    return (
      <ul className="CanelaReview-filters reviewable-filters" role="tablist" aria-label={rt('filter_label')}>
        {options.map((option) => (
          <li key={option.key} className={classList('CanelaReview-filter', { active: this.filter === option.key })}>
            <button
              type="button"
              role="tab"
              aria-selected={this.filter === option.key ? 'true' : 'false'}
              onclick={() => {
                this.filter = option.key;
              }}
            >
              {option.label}
              {this.countFor(option.key) ? <span className="CanelaReview-filterCount">{this.countFor(option.key)}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  countFor(filter: ReviewFilter): number {
    if (filter === 'chat') return this.chatReports.length;
    if (filter === 'all') return this.posts.length + this.chatReports.length;
    if (filter === 'flagged') return this.posts.filter((post) => !isQueued(post)).length + this.chatReports.length;

    return this.posts.filter((post) => (filter === 'queued' ? isQueued(post) : !isQueued(post))).length;
  }

  item(post: Post): Mithril.Children {
    const id = post.id()!;
    const queued = isQueued(post);
    const flags = postFlags(post).filter((flag) => flag.type() !== 'approval');
    const discussion: any = post.discussion();
    const user = post.user() as User | false;
    const created = queued
      ? post.createdAt()
      : flags
          .map((flag) => flag.createdAt())
          .filter(Boolean)
          .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];
    const long = (post.contentPlain?.() || '').length > COLLAPSE_AT;
    const collapsed = long && !this.expanded.has(id);

    return (
      <article
        key={id}
        className={classList('reviewable-item', queued ? 'reviewable-queued-post' : 'reviewable-flagged-post', {
          'is-busy': this.busy.has(id),
          'is-hidden': post.isHidden(),
        })}
        data-post-id={id}
      >
        <div className="reviewable-meta-data">
          <span className="reviewable-type">{queued ? rt('type_queued') : rt('type_flagged')}</span>
          {queued ? null : this.reasonChips(flags)}
          <span className="created-at" title={created ? fullDate(created) : undefined}>
            {created ? <Link href={app.route.post(post)}>{shortAge(created)}</Link> : null}
          </span>
          <span className="reviewable-status status pending">{rt('status_pending')}</span>
        </div>

        {discussion ? (
          <div className="post-topic">
            <Link className="title-text" href={app.route.discussion(discussion)}>
              {discussion.title()}
            </Link>
            {isTagsEnabled() ? discussionBadges(discussion) : null}
          </div>
        ) : null}

        <div className="post-contents-wrapper">
          <div className="created-by">
            {user ? (
              <Link href={app.route.user(user)} title={user.displayName()}>
                <Avatar user={user} />
              </Link>
            ) : (
              <Avatar user={null} />
            )}
          </div>
          <div className="post-contents">
            <div className="post-information">
              {user ? (
                <Link className="names username" href={app.route.user(user)}>
                  {username(user)}
                </Link>
              ) : (
                <span className="names username">{username(user)}</span>
              )}
              {post.isHidden() ? (
                <span className="CanelaReview-hiddenLabel">
                  <Icon name="far fa-eye-slash" />
                  {rt('hidden_label')}
                </span>
              ) : null}
              <Link className="CanelaReview-postLink" href={app.route.post(post)}>
                <Icon name="fas fa-up-right-from-square" />
                {rt('view_post')}
              </Link>
            </div>
            <div className={classList('post-body Post-body', { 'is-collapsed': collapsed })}>{m.trust(post.contentHtml() || '')}</div>
            {long ? (
              <Button
                className="Button Button--flat post-body__toggle-btn"
                icon={collapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up'}
                onclick={() => (collapsed ? this.expanded.add(id) : this.expanded.delete(id))}
              >
                {collapsed ? rt('show_more') : rt('show_less')}
              </Button>
            ) : null}
          </div>
        </div>

        {queued ? <div className="reviewable-score-reason">{rt('queued_reason')}</div> : this.scores(flags)}

        <div className="reviewable-actions">{queued ? this.queuedActions(post) : this.flaggedActions(post)}</div>
      </article>
    );
  }

  /** "Inadequado ×2" — os motivos somados, como o `.review-item__flag-badges`. */
  reasonChips(flags: any[]): Mithril.Children {
    const counts = new Map<string, { flag: any; count: number }>();

    flags.forEach((flag) => {
      const key = flag.reason?.() || 'other';
      const entry = counts.get(key);

      if (entry) entry.count++;
      else counts.set(key, { flag, count: 1 });
    });

    return (
      <span className="CanelaReview-reasons">
        {Array.from(counts.values()).map(({ flag, count }) => (
          <span className="reviewable-score-type">
            <Icon name={reasonIcon(flag)} />
            {reasonLabel(flag)}
            {count > 1 ? <span className="CanelaReview-reasonCount">×{count}</span> : null}
          </span>
        ))}
      </span>
    );
  }

  /** Quem sinalizou, o motivo, quando e a mensagem (o `.reviewable-scores` do Discourse). */
  scores(flags: any[]): Mithril.Children {
    if (!flags.length) return null;

    return (
      <div className="reviewable-scores">
        <table>
          <thead>
            <tr>
              <th>{rt('flagged_by')}</th>
              <th>{rt('flag_type')}</th>
              <th>{rt('flag_date')}</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => {
              const flagger = flag.user?.() as User | false;
              const detail = flag.reasonDetail?.() || '';

              return [
                <tr className="reviewable-score">
                  <td className="user">
                    {flagger ? (
                      <Link href={app.route.user(flagger)}>
                        <Avatar user={flagger} />
                        <span>{flagger.displayName()}</span>
                      </Link>
                    ) : (
                      <span>{username(flagger)}</span>
                    )}
                  </td>
                  <td className="CanelaReview-reason">
                    <Icon name={reasonIcon(flag)} />
                    {reasonLabel(flag)}
                  </td>
                  <td className="CanelaReview-when" title={flag.createdAt() ? fullDate(flag.createdAt()) : undefined}>
                    {shortAge(flag.createdAt())}
                  </td>
                </tr>,
                detail ? (
                  <tr className="reviewable-score-detail">
                    <td colspan={3}>
                      <blockquote className="reviewable-conversation-post">{detail}</blockquote>
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>
    );
  }

  flaggedActions(post: Post): Mithril.Children {
    const id = post.id()!;
    const disabled = this.busy.has(id);
    const canHide = !!post.canHide?.();
    const hidden = post.isHidden();
    const agree: Mithril.Children[] = [];

    if (canHide && !hidden) {
      agree.push(
        <Button icon="far fa-eye-slash" onclick={() => this.run(post, () => this.hide(post).then(() => this.dismiss(post)), 'done_agreed_hidden')}>
          {rt('agree_and_hide')}
        </Button>
      );
    }

    agree.push(
      <Button icon="far fa-thumbs-up" onclick={() => this.run(post, () => this.dismiss(post), 'done_agreed')}>
        {hidden ? rt('agree_and_keep_hidden') : rt('agree_and_keep')}
      </Button>
    );

    return [
      <Dropdown
        className="CanelaReview-agree"
        buttonClassName="Button Button--primary"
        label={rt('agree')}
        icon="far fa-thumbs-up"
        accessibleToggleLabel={rt('agree')}
      >
        {agree}
      </Dropdown>,
      <Button
        className="Button"
        icon="far fa-thumbs-down"
        disabled={disabled}
        onclick={() =>
          this.run(post, () => (hidden && canHide ? this.restore(post) : Promise.resolve()).then(() => this.dismiss(post)), 'done_disagreed')
        }
      >
        {hidden && canHide ? rt('disagree_and_restore') : rt('disagree')}
      </Button>,
      <Button
        className="Button"
        icon="fas fa-right-from-bracket"
        disabled={disabled}
        onclick={() => this.run(post, () => this.dismiss(post), 'done_ignored')}
      >
        {rt('ignore')}
      </Button>,
      this.canDelete(post) ? (
        <Button
          className="Button Button--danger"
          icon="far fa-trash-can"
          disabled={disabled}
          onclick={() => this.confirmDelete(post, 'done_deleted')}
        >
          {rt('delete_post')}
        </Button>
      ) : null,
    ];
  }

  queuedActions(post: Post): Mithril.Children {
    const disabled = this.busy.has(post.id()!);

    return [
      (post as any).canApprove?.() ? (
        <Button
          className="Button Button--primary"
          icon="fas fa-check"
          disabled={disabled}
          onclick={() => this.run(post, () => this.approve(post), 'done_approved')}
        >
          {rt('approve_post')}
        </Button>
      ) : null,
      this.canDelete(post) ? (
        <Button
          className="Button Button--danger"
          icon="fas fa-xmark"
          disabled={disabled}
          onclick={() => this.confirmDelete(post, 'done_rejected', rt('reject_confirm'))}
        >
          {rt('reject_post')}
        </Button>
      ) : null,
    ];
  }

  // -------------------------------------------------------------------
  // Ações: as mesmas chamadas do flarum/flags (DELETE /posts/:id/flags), do
  // core (ocultar, restaurar, excluir) e do flarum/approval (isApproved).
  // -------------------------------------------------------------------

  /** Excluir o primeiro post é excluir o tópico, como no Discourse. */
  canDelete(post: Post): boolean {
    const discussion: any = post.discussion();

    if (post.number() === 1 && discussion) return !!discussion.canDelete?.();

    return !!post.canDelete?.();
  }

  run(post: Post, action: () => Promise<unknown>, doneKey: string): void {
    const id = post.id()!;

    if (this.busy.has(id)) return;

    this.busy.add(id);

    action()
      .then(() => {
        this.resolved(post);
        app.alerts.show({ type: 'success' }, rt(doneKey));
      })
      .catch(() => {})
      .then(() => {
        this.busy.delete(id);
        m.redraw();
      });
  }

  confirmDelete(post: Post, doneKey: string, question = rt('delete_confirm')): void {
    if (!confirm(question)) return;

    this.run(post, () => this.delete(post), doneKey);
  }

  dismiss(post: Post): Promise<unknown> {
    return app.request({ url: app.forum.attribute('apiUrl') + (post as any).apiEndpoint() + '/flags', method: 'DELETE' }).then(() => {
      // Como o `dismissFlag` do flarum/flags: o post no tópico perde a faixa.
      if ((post.data as any).relationships) delete (post.data as any).relationships.flags;
    });
  }

  hide(post: Post): Promise<unknown> {
    post.pushData({ attributes: { hiddenAt: new Date() }, relationships: { hiddenUser: app.session.user } } as any);

    return post.save({ isHidden: true });
  }

  restore(post: Post): Promise<unknown> {
    post.pushData({ attributes: { hiddenAt: null }, relationships: { hiddenUser: null } } as any);

    return post.save({ isHidden: false });
  }

  approve(post: Post): Promise<unknown> {
    return post.save({ isApproved: true } as any).then(() => {
      if (post.number() === 1) (post.discussion() as any)?.pushAttributes({ isApproved: true });

      // A sinalização `approval` fica: o flarum/flags a apaga junto, como o
      // botão "Aprovar" da faixa do post.
      return this.dismiss(post);
    });
  }

  delete(post: Post): Promise<unknown> {
    const discussion: any = post.discussion();

    if (post.number() === 1 && discussion) {
      return discussion.delete().then(() => (app as any).discussions?.removeDiscussion?.(discussion));
    }

    return post.delete().then(() => discussion?.removePost?.(post.id()));
  }

  /** Sai da fila; o contador do menu e a lista do `app.flags` acompanham. */
  resolved(post: Post): void {
    this.posts = this.posts.filter((item) => item !== post);
    this.expanded.delete(post.id()!);

    const count = Number(app.forum.attribute<number>('flagCount') || 0);
    app.forum.pushAttributes({ flagCount: Math.max(0, count - 1) });

    const flags: any = (app as any).flags;
    if (flags && typeof flags.clear === 'function') flags.clear();
  }
}
