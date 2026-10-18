import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import ItemList from 'flarum/common/utils/ItemList';
import formatNumber from 'flarum/common/utils/formatNumber';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import AboutNav from './AboutNav';
import CommunityPage from './CommunityPage';
import UserTile from './UserTile';
import { fetchAbout, pushUsers, type AboutPayload, type StatPeriod } from './api';
import { forumBool, t } from '../../utils/settings';
import { fullDate } from '../../utils/dates';

/** As linhas da tabela de estatísticas, na ordem do Discourse, com o ícone de cada uma. */
const STAT_ROWS: [key: string, icon: string][] = [
  ['topics', 'far fa-comments'],
  ['posts', 'far fa-comment'],
  ['users', 'fas fa-user-plus'],
  ['activeUsers', 'fas fa-user-check'],
  ['likes', 'far fa-heart'],
];

const STAT_PERIODS: StatPeriod[] = ['day', 'week', 'month', 'all'];

/**
 * A página "Sobre" do Discourse (/about): o fórum, o que o admin escreveu
 * sobre ele, como falar com a equipe, quem é a equipe e os números do site.
 */
export default class AboutPage extends CommunityPage {
  data: AboutPayload | null = null;
  failed = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    if (this.enabled()) this.load();
  }

  title(): string {
    return t('community.about.title');
  }

  className(): string {
    return 'CanelaAboutPage';
  }

  enabled(): boolean {
    return forumBool('canelaAboutEnabled', true);
  }

  load(): void {
    fetchAbout()
      .then((data) => {
        pushUsers(data.included || []);
        this.data = data;
      })
      .catch(() => (this.failed = true))
      .finally(() => m.redraw());
  }

  content(): Mithril.Children {
    return <div className="CanelaAbout">{this.sectionItems().toArray()}</div>;
  }

  sectionItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const data = this.data;

    items.add('header', this.header(), 100);

    if (this.failed) {
      items.add('error', <p className="CanelaCommunity-empty">{t('community.load_error')}</p>, 90);
      return items;
    }

    if (!data) {
      items.add('loading', <LoadingIndicator display="block" />, 90);
      return items;
    }

    items.add(
      'main',
      <div className="CanelaAbout-main">
        <div className="CanelaAbout-left">{this.leftItems(data).toArray()}</div>
        <aside className="CanelaAbout-right">{this.rightItems(data).toArray()}</aside>
      </div>,
      80
    );

    if (data.stats) items.add('stats', this.statsTable(data.stats), 70);

    return items;
  }

  /** As abas do topo (Sobre, Diretrizes, Termos, Privacidade), o nome do fórum e a descrição. */
  header(): Mithril.Children {
    const description = app.forum.attribute<string>('description');

    return (
      <header className="CanelaAbout-header">
        {AboutNav('canela.about')}
        <h1 className="CanelaAbout-title">{app.forum.attribute<string>('title')}</h1>
        {description && <p className="CanelaAbout-description">{description}</p>}
      </header>
    );
  }

  /** A faixa de números logo abaixo do título: membros, equipe e idade do fórum. */
  summary(data: AboutPayload): Mithril.Children {
    const items = new ItemList<Mithril.Children>();

    items.add('members', this.summaryItem('fas fa-users', t('community.about.members', { count: data.members })), 100);

    if (data.adminCount !== null) {
      items.add('admins', this.summaryItem('fas fa-shield-halved', t('community.about.admin_count', { count: data.adminCount })), 90);
    }

    if (data.moderatorCount !== null) {
      items.add('moderators', this.summaryItem('fas fa-shield', t('community.about.moderator_count', { count: data.moderatorCount })), 80);
    }

    if (data.createdAt) {
      // "Criado há 11 anos", relativo como no Discourse; a data exata no title.
      const created = new Date(data.createdAt);
      items.add(
        'created',
        this.summaryItem('far fa-calendar', t('community.about.created_ago', { ago: dayjs(created).fromNow() }), fullDate(created)),
        70
      );
    }

    return <ul className="CanelaAbout-summary">{items.toArray()}</ul>;
  }

  summaryItem(icon: string, text: string, title?: string): Mithril.Children {
    return (
      <li className="CanelaAbout-summaryItem" title={title}>
        <Icon name={icon} />
        <span>{text}</span>
      </li>
    );
  }

  leftItems(data: AboutPayload): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    items.add('summary', this.summary(data), 110);

    // O texto é do admin (HTML que ele mesmo escreveu, ou o Markdown já
    // renderizado pelo formatador do fórum no servidor).
    if (data.aboutHtml) {
      items.add(
        'text',
        <section className="CanelaAbout-about">
          <h2 className="CanelaAbout-sectionTitle">{t('community.about.title')}</h2>
          <div className="CanelaAbout-text">{m.trust(data.aboutHtml)}</div>
        </section>,
        100
      );
    }

    if (data.admins?.length) items.add('admins', this.staffSection('admins', t('community.about.our_admins'), data.admins), 90);
    if (data.moderators?.length) items.add('moderators', this.staffSection('moderators', t('community.about.our_moderators'), data.moderators), 80);

    return items;
  }

  staffSection(name: string, title: string, ids: string[]): Mithril.Children {
    const users = ids.map((id) => app.store.getById<User>('users', id)).filter((user): user is User => !!user);

    return (
      <section className={`CanelaAbout-staff CanelaAbout-staff--${name}`}>
        <h2 className="CanelaAbout-sectionTitle">{title}</h2>
        <ul className="CanelaAbout-users">
          {users.map((user) => (
            <li key={user.id()}>
              <UserTile user={user} />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  rightItems(data: AboutPayload): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();

    if (data.contactEmail || data.contactUrl) items.add('contact', this.contact(data), 100);
    if (data.stats) items.add('activity', this.activity(data.stats), 90);

    return items;
  }

  contact(data: AboutPayload): Mithril.Children {
    return (
      <section className="CanelaAbout-box CanelaAbout-contact">
        <h2 className="CanelaAbout-sectionTitle">{t('community.about.contact_title')}</h2>
        <p className="CanelaAbout-contactInfo">
          {t('community.about.contact_text')} {data.contactEmail && <a href={`mailto:${data.contactEmail}`}>{data.contactEmail}</a>}
          {data.contactEmail && data.contactUrl && ' · '}
          {data.contactUrl && (
            <a href={data.contactUrl} target="_blank" rel="noopener noreferrer">
              {data.contactUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
        </p>
      </section>
    );
  }

  /** "Atividade do site": a coluna de números da semana do Discourse. */
  activity(stats: NonNullable<AboutPayload['stats']>): Mithril.Children {
    const rows = STAT_ROWS.filter(([key]) => stats[key]);

    return (
      <section className="CanelaAbout-box CanelaAbout-activity">
        <h2 className="CanelaAbout-sectionTitle">{t('community.about.activity_title')}</h2>
        <ul className="CanelaAbout-activityList">
          {rows.map(([key, icon]) => {
            // A coluna mostra a semana, como o Discourse; a tabela abaixo tem
            // os outros períodos.
            const count = stats[key].week ?? 0;

            return (
              <li className="CanelaAbout-activityItem">
                <span className="CanelaAbout-activityIcon">
                  <Icon name={icon} />
                </span>
                <span className="CanelaAbout-activityText">
                  <span className="CanelaAbout-activityCount">{t(`community.about.activity.${key}`, { count, formatted: formatNumber(count) })}</span>
                  <span className="CanelaAbout-activityPeriod">{t('community.about.last_7_days')}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  statsTable(stats: NonNullable<AboutPayload['stats']>): Mithril.Children {
    const rows = STAT_ROWS.filter(([key]) => stats[key]);

    return (
      <section className="CanelaAbout-statsSection">
        <h2 className="CanelaAbout-sectionTitle">{t('community.about.stats_title')}</h2>
        <div className="CanelaCommunity-tableWrap">
          <table className="CanelaCommunity-table CanelaAbout-statsTable">
            <thead>
              <tr>
                <th />
                {STAT_PERIODS.map((period) => (
                  <th className="CanelaCommunity-num">{t(`community.about.period.${period}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, icon]) => (
                <tr>
                  <th scope="row">
                    <Icon name={icon} className="CanelaAbout-statsIcon" />
                    {t(`community.about.stat.${key}`)}
                  </th>
                  {STAT_PERIODS.map((period) => {
                    const value = stats[key][period];

                    return <td className="CanelaCommunity-num">{value === null || value === undefined ? '-' : formatNumber(value)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
}
