/*
 * A linha da lista de tópicos do Discourse: [Tópico | Postadores | Respostas |
 * Visualizações | Atividade] no desktop; avatar, título e contagem no celular.
 *
 * Mexe só nas ItemLists do DiscussionListItem: o que outras extensões põem em
 * infoItems (o excerto do sticky, a digitação do realtime) e em statsItems
 * continua aparecendo, só que no lugar do Discourse.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import IndexPage from 'flarum/forum/components/IndexPage';
import Link from 'flarum/common/components/Link';
import Avatar from 'flarum/common/components/Avatar';
import Tooltip from 'flarum/common/components/Tooltip';
import listItems from 'flarum/common/helpers/listItems';
import highlight from 'flarum/common/helpers/highlight';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import { truncate } from 'flarum/common/utils/string';
import type ItemList from 'flarum/common/utils/ItemList';
import type Discussion from 'flarum/common/models/Discussion';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { forumBool, t } from '../utils/settings';
import { fullDate, shortAge } from '../utils/dates';
import { discussionBadges } from '../utils/tags';
import { activityCold, discussionViews, repliesHeat, viewsHeat } from './metrics';
import { viewsNumber } from '../utils/views';

/** Chaves do infoItems que a linha nova desenha em outro lugar (ou dispensa). */
const MOVED_INFO = ['tags', 'terminalPost', 'excerpt'];

/**
 * O MinimalDiscussionListItem (resultados do modal de busca) herda desta
 * classe; lá a linha compacta do core continua valendo. A classe CSS é o único
 * jeito estável de reconhecê-lo — o módulo pode nem estar carregado. (Por isso
 * o tema não estende elementAttrs: a checagem chama elementAttrs e entraria em
 * laço; o CSS da linha mira `.CanelaList .DiscussionListItem`.)
 */
function isMinimal(item: DiscussionListItem): boolean {
  return String(item.elementAttrs().className || '').includes('MinimalDiscussionListItem');
}

function heatClass(heat: string | null, kind: 'heat' | 'cold' = 'heat'): string | undefined {
  return heat && forumBool('canelaListHeat', true) ? `CanelaCell--${kind}-${heat}` : undefined;
}

function posterAvatar(user: User | null | false, role: string, className = ''): Mithril.Children {
  if (!user) return null;

  const label = `${user.displayName()}: ${role}`;

  return (
    <Tooltip text={label}>
      <Link href={app.route.user(user)} className={classList('CanelaPosters-avatar', className)} aria-label={label}>
        <Avatar user={user} title="" />
      </Link>
    </Tooltip>
  );
}

export default function installListItem(): void {
  // Ao voltar de um tópico, o Discourse pinta a linha dele com --tertiary-low
  // e apaga em 2,5s (`.topic-list-item.highlighted`). O core já guarda qual
  // foi (lastDiscussion) e rola até ela; o tema só acende a linha.
  extend(IndexPage.prototype, 'oncreate', function (this: IndexPage) {
    const last = this.lastDiscussion;

    if (!last) return;

    const row = this.element?.querySelector(`li[data-id="${last.id()}"] .DiscussionListItem`);

    if (!row) return;

    row.classList.add('CanelaListItem--highlighted');
    row.addEventListener('animationend', () => row.classList.remove('CanelaListItem--highlighted'), { once: true });
  });

  extend(DiscussionListItem.prototype, 'contentItems', function (this: DiscussionListItem, items: ItemList<Mithril.Children>) {
    if (isMinimal(this)) return;

    // O avatar grande da esquerda e a coluna de estatísticas do core saem:
    // o Discourse mostra os postadores e os números em colunas próprias.
    items.remove('author');
    items.remove('stats');

    // Só no celular (o CSS esconde no desktop), como o avatar de 48px do Discourse.
    items.add('canelaAvatar', avatarView(this), 100);

    if (forumBool('canelaListPosters', true)) {
      items.add('canelaPosters', postersView(this), 60);
    }

    items.add('canelaReplies', repliesView(this), 50);

    if (forumBool('canelaListViews', true)) {
      // Sempre desenhada: quem decide se a coluna aparece é a lista inteira
      // (classe no DiscussionList), não cada linha.
      items.add('canelaViews', viewsView(this), 40);
    }

    items.add('canelaActivity', activityView(this), 30);
  });

  override(DiscussionListItem.prototype, 'mainView', function (this: DiscussionListItem, original: () => Mithril.Children) {
    if (isMinimal(this)) return original();

    const discussion = this.attrs.discussion;
    const jumpTo = this.getJumpTo();
    const info = this.infoItems();
    const searching = !!this.attrs.params.q;

    // O excerto do fixado é opcional; o da busca, não — ele é o resultado.
    const excerpt =
      info.has('excerpt') && (searching || forumBool('canelaListExcerpts', true)) ? excerptView(this, info.get('excerpt'), searching) : null;

    MOVED_INFO.forEach((key) => info.remove(key));

    // statsItems de extensões (curtidas, por exemplo) não têm coluna própria:
    // vão para a linha das etiquetas. A contagem de respostas já é coluna.
    const extraStats = this.statsItems();
    extraStats.remove('replyCount');

    const badgeList = discussion.badges();

    // No Discourse o cadeado (fechado) vem antes do alfinete (fixado).
    if (badgeList.has('locked')) badgeList.setPriority('locked', 1000);

    const badges = badgeList.toArray();

    return (
      <div className="DiscussionListItem-main CanelaTopic">
        <h2 className="DiscussionListItem-title CanelaTopic-titleLine">
          {badges.length > 0 && <span className="CanelaTopic-status">{badges}</span>}
          <Link href={app.route.discussion(discussion, jumpTo)} className="CanelaTopic-title">
            {highlight(discussion.title(), this.highlightRegExp)}
          </Link>
          {unreadView(this)}
        </h2>
        <div className="CanelaTopic-meta">
          {discussionBadges(discussion)}
          {!info.isEmpty() && <ul className="DiscussionListItem-info CanelaTopic-info">{listItems(info.toArray())}</ul>}
          {!extraStats.isEmpty() && <span className="CanelaTopic-stats">{extraStats.toArray()}</span>}
        </div>
        {excerpt ? <div className="CanelaTopic-excerpt">{excerpt}</div> : null}
      </div>
    );
  });
}

/**
 * Bolinha de "tópico novo" (nunca aberto) ou pílula com as não lidas, como o
 * Discourse. As duas marcam como lido ao clicar, igual à contagem do core.
 */
function unreadView(item: DiscussionListItem): Mithril.Children {
  const discussion = item.attrs.discussion;

  if (!app.session.user || !discussion.isUnread()) return null;

  const neverRead = !discussion.lastReadPostNumber();
  const label = neverRead ? t('list.new_topic') : t('list.unread_count', { count: discussion.unreadCount() });

  return (
    <button
      type="button"
      className={classList('Button--ua-reset CanelaUnread', neverRead ? 'CanelaUnread--new' : 'CanelaUnread--count')}
      title={`${label}: ${t('list.mark_read')}`}
      aria-label={`${label}: ${t('list.mark_read')}`}
      onclick={(event: MouseEvent) => {
        event.preventDefault();
        item.markAsRead();
      }}
    >
      {neverRead ? null : abbreviateNumber(discussion.unreadCount())}
    </button>
  );
}

/**
 * O excerto do fixado termina com "… ler mais" quando foi cortado, como o
 * `.topic-excerpt-more` do Discourse. O flarum/sticky entrega o texto já
 * truncado dentro de um div; o tema refaz o corte para pôr o link na mesma
 * linha. O da busca (trecho com destaque) fica como veio.
 */
function excerptView(item: DiscussionListItem, original: Mithril.Children, searching: boolean): Mithril.Children {
  const discussion = item.attrs.discussion;
  const text = discussion.attribute<string | null>('firstPostExcerpt');

  if (searching || typeof text !== 'string' || !text) return original;

  const limit = 175;

  if (text.length <= limit) return text;

  return [
    truncate(text, limit),
    ' ',
    <Link href={app.route.discussion(discussion)} className="CanelaTopic-excerptMore">
      {t('list.read_more')}
    </Link>,
  ];
}

function avatarView(item: DiscussionListItem): Mithril.Children {
  const user = item.attrs.author || item.attrs.discussion.user();

  return (
    <div className="CanelaListItem-avatar">
      {user ? (
        <Link href={app.route.user(user)} aria-label={user.displayName()}>
          <Avatar user={user} title="" />
        </Link>
      ) : (
        <Avatar user={null} title="" />
      )}
    </div>
  );
}

function postersView(item: DiscussionListItem): Mithril.Children {
  const discussion: Discussion = item.attrs.discussion;
  const author = item.attrs.author || discussion.user();
  const last = discussion.replyCount() ? discussion.lastPostedUser() : null;
  const relevantPost = item.attrs.params.q ? discussion.mostRelevantPost() : null;
  const relevant = relevantPost ? relevantPost.user() : null;

  // O "último postador" do Discourse (`a.latest`): quem respondeu por último
  // ou, sem respostas, o próprio autor. É o único avatar que sobra no tablet.
  const latest = last || author;

  const seen = new Set<string | undefined>();
  const entries: { user: User; role: string }[] = [];

  const push = (user: User | null | false | undefined, role: string) => {
    if (!user || seen.has(user.id())) return;

    seen.add(user.id());
    entries.push({ user, role });
  };

  push(author, t('list.original_poster'));
  push(relevant, t('list.relevant_poster'));
  push(last, t('list.most_recent_poster'));

  const posters = entries.map(({ user, role }, index) => {
    const isLatest = !!latest && user === latest;

    return posterAvatar(
      user,
      role,
      classList({
        'CanelaPosters-avatar--latest': isLatest,
        // O autor que também postou por último brilha, se houver outros
        // avatares ao lado (`.avatar.latest:not(.single)`).
        'CanelaPosters-avatar--glow': isLatest && index === 0 && entries.length > 1,
      })
    );
  });

  return <div className="CanelaCell CanelaCell--posters CanelaPosters">{posters}</div>;
}

function repliesView(item: DiscussionListItem): Mithril.Children {
  const count = item.attrs.discussion.replyCount() ?? 0;

  return (
    <div className={classList('CanelaCell CanelaCell--replies', heatClass(repliesHeat(count)))}>
      <span aria-hidden="true">{abbreviateNumber(count)}</span>
      <span className="visually-hidden">{t('list.replies_a11y', { count })}</span>
    </div>
  );
}

function viewsView(item: DiscussionListItem): Mithril.Children {
  const views = discussionViews(item.attrs.discussion);

  return (
    <div className={classList('CanelaCell CanelaCell--views', views !== null && heatClass(viewsHeat(views)))}>
      {/* O `dNumber … numberKey="views_long"` do Discourse: "1,2k" com o title por extenso. */}
      {views === null ? null : viewsNumber(views)}
    </div>
  );
}

function activityView(item: DiscussionListItem): Mithril.Children {
  const discussion: Discussion = item.attrs.discussion;
  const created = discussion.createdAt();
  const last = discussion.lastPostedAt() || created;
  const title = [
    t('list.created_at', { date: fullDate(created) }),
    discussion.replyCount() ? t('list.last_reply_at', { date: fullDate(last) }) : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className={classList('CanelaCell CanelaCell--activity', heatClass(activityCold(discussion), 'cold'))} title={title}>
      <Link href={app.route.discussion(discussion, discussion.lastPostNumber() ?? undefined)} className="CanelaActivity">
        {shortAge(last)}
      </Link>
    </div>
  );
}
