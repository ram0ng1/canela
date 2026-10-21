/*
 * Uma mensagem do chat denunciada (ramon/chat: `chat-message-flags`) como
 * item da fila "Revisar" do tema (review/ReviewQueue.tsx), no mesmo
 * `.reviewable-item` que os posts: o tipo, os motivos, o canal,
 * a mensagem, o autor, quem denunciou e por quê, e as ações da fila do
 * próprio ramon/chat (/chat/flags) pelos endpoints dele — descartar (resolver
 * as denúncias) e excluir a mensagem — mais o link para ela no chat.
 *
 * Mora no chunk da fila: só ela importa este módulo.
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import extractText from 'flarum/common/utils/extractText';
import username from 'flarum/common/helpers/username';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { fullDate, shortAge } from '../../../utils/dates';
import { t } from '../../../utils/settings';
import { apiUrl, rt } from './flags';
import { messagePath } from './permalink';
import type { ChatReport } from './reviewData';

export interface ChatReportContext {
  busy: Set<string>;
  onResolved: (report: ChatReport) => void;
}

function reviewText(key: string, params: Record<string, unknown> = {}): string {
  return t(`review.${key}`, params);
}

/** Traduz se a chave existe (o tradutor devolve a própria chave quando não). */
function maybe(key: string): string | null {
  const text = extractText(app.translator.trans(key));

  return text && text !== key ? text : null;
}

/**
 * O motivo com o nome do ramon/chat; sem ele, o do flarum/flags (os dois
 * passam a usar os mesmos motivos); por fim, o próprio código.
 */
function reasonLabel(flag: any): string {
  const reason = flag.reason?.() || 'other';

  return maybe(`ramon-chat.forum.flag.reasons.${reason}`) || maybe(`flarum-flags.forum.flag_post.reason_${reason}_label`) || reason;
}

function reasonIcon(flag: any): string {
  switch (flag.reason?.()) {
    case 'off_topic':
      return 'fas fa-comment-slash';
    case 'spam':
      return 'fas fa-ban';
    case 'harassment':
    case 'inappropriate':
      return 'fas fa-triangle-exclamation';
    default:
      return 'fas fa-flag';
  }
}

/** Resolve as denúncias da mensagem (o "Resolver" da fila do ramon/chat). */
function resolveAll(report: ChatReport): Promise<unknown> {
  return Promise.all(report.flags.map((flag) => app.request({ method: 'POST', url: apiUrl(`/chat-message-flags/${flag.id()}/resolve`) })));
}

/**
 * Exclui a mensagem. O ramon/chat já resolve as denúncias dela
 * (ResolveFlagsOnModeration); resolver de novo aqui garante a saída da fila.
 */
function deleteMessage(report: ChatReport): Promise<unknown> {
  const message = report.message;

  return app.request({ method: 'POST', url: apiUrl(`/chat-messages/${message.id()}/delete`) }).then(() => {
    message.pushAttributes({ isDeleted: true, content: null, contentHtml: null, isModeratorDeleted: true });

    return resolveAll(report).catch(() => {});
  });
}

function run(report: ChatReport, ctx: ChatReportContext, action: () => Promise<unknown>, done: string): void {
  if (ctx.busy.has(report.key)) return;

  ctx.busy.add(report.key);

  action()
    .then(() => {
      ctx.onResolved(report);

      // O contador do ramon/chat (barra lateral, menu do usuário) acompanha.
      const count = Number(app.forum.attribute<number>('chatOpenFlagsCount') || 0);
      app.forum.pushAttributes({ chatOpenFlagsCount: Math.max(0, count - report.flags.length) });

      app.alerts.show({ type: 'success' }, done);
    })
    .catch(() => {})
    .then(() => {
      ctx.busy.delete(report.key);
      m.redraw();
    });
}

function reasonChips(report: ChatReport): Mithril.Children {
  const reasons = new Map<string, { flag: any; count: number }>();

  report.flags.forEach((flag) => {
    const reason = flag.reason?.() || 'other';
    const entry = reasons.get(reason);

    if (entry) entry.count++;
    else reasons.set(reason, { flag, count: 1 });
  });

  return (
    <span className="CanelaReview-reasons">
      {Array.from(reasons.values()).map(({ flag, count }) => (
        <span className="reviewable-score-type">
          <Icon name={reasonIcon(flag)} />
          {reasonLabel(flag)}
          {count > 1 ? <span className="CanelaReview-reasonCount">×{count}</span> : null}
        </span>
      ))}
    </span>
  );
}

/** Quem denunciou, o motivo, quando e o detalhe (o `.reviewable-scores`). */
function scores(report: ChatReport): Mithril.Children {
  return (
    <div className="reviewable-scores">
      <table>
        <thead>
          <tr>
            <th>{reviewText('flagged_by')}</th>
            <th>{reviewText('flag_type')}</th>
            <th>{reviewText('flag_date')}</th>
          </tr>
        </thead>
        <tbody>
          {report.flags.map((flag) => {
            const flagger = (flag.user?.() as User | false) || null;
            const detail = flag.detail?.() || '';
            const at: Date | null = flag.createdAt?.() || null;

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
                <td className="CanelaReview-when" title={at ? fullDate(at) : undefined}>
                  {at ? shortAge(at) : ''}
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

/** O item da fila de uma mensagem do chat denunciada. */
export function chatReportItem(report: ChatReport, ctx: ChatReportContext): Mithril.Children {
  const message = report.message;
  const channel = message.channel?.() || null;
  const user = (message.user?.() as User | false) || null;
  const href = messagePath(Number(message.channelId()), Number(message.id()), message.threadId?.());
  const deleted = !!message.isDeleted?.();
  const busy = ctx.busy.has(report.key);

  return (
    <article
      key={report.key}
      className={classList('reviewable-item reviewable-flagged-chat-message', { 'is-busy': busy })}
      data-chat-message-id={message.id()}
    >
      <div className="reviewable-meta-data">
        <span className="reviewable-type">{rt('review.type')}</span>
        {reasonChips(report)}
        <span className="created-at" title={fullDate(report.date)}>
          <Link href={href}>{shortAge(report.date)}</Link>
        </span>
        <span className="reviewable-status status pending">{reviewText('status_pending')}</span>
      </div>

      {channel ? (
        <div className="post-topic CanelaReview-chatChannel">
          <Icon name={channel.isDirect?.() ? 'far fa-envelope' : 'far fa-message'} />
          <Link className="title-text" href={app.route('chat.channel', { id: channel.id() })}>
            {channel.isDirect?.() ? channel.displayName() : `#${channel.displayName()}`}
          </Link>
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
            <Link className="CanelaReview-postLink" href={href}>
              <Icon name="fas fa-up-right-from-square" />
              {rt('review.view_in_chat')}
            </Link>
          </div>
          <div className="post-body Post-body CanelaReview-chatBody">
            {deleted ? (
              <em className="CanelaReview-chatDeleted">{rt('review.message_deleted')}</em>
            ) : message.contentHtml?.() ? (
              // O HTML do formatador do servidor (o mesmo que o ramon/chat desenha).
              m.trust(message.contentHtml())
            ) : (
              message.content?.() || ''
            )}
          </div>
        </div>
      </div>

      {scores(report)}

      <div className="reviewable-actions">
        <Button
          className="Button Button--primary"
          icon="fas fa-check"
          disabled={busy}
          onclick={() => run(report, ctx, () => resolveAll(report), rt('review.done_dismissed'))}
        >
          {rt('review.dismiss')}
        </Button>
        {!deleted && message.canDelete?.() ? (
          <Button
            className="Button Button--danger"
            icon="far fa-trash-can"
            disabled={busy}
            onclick={() => {
              if (!confirm(rt('review.delete_confirm'))) return;

              run(report, ctx, () => deleteMessage(report), rt('review.done_deleted'));
            }}
          >
            {rt('review.delete_message')}
          </Button>
        ) : null}
        <Link className="Button" href={href}>
          <Icon name="far fa-message" className="Button-icon" />
          <span className="Button-label">{rt('review.view_in_chat')}</span>
        </Link>
      </div>
    </article>
  );
}
