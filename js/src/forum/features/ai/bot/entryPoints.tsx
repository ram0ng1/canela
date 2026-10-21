/*
 * Os caminhos até o bot:
 *
 * - o ícone do robô no cabeçalho, que dentro das
 *   conversas vira o "sair do bot de IA" e volta para onde a pessoa estava;
 * - o link "Bot de IA" na seção da comunidade da barra lateral;
 * - e, na página de conversas, a barra lateral inteira troca de conteúdo:
 *   "Nova pergunta" e as conversas agrupadas em Hoje, Últimos sete dias,
 *   Últimos 30 dias e os meses.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import Dropdown from 'flarum/common/components/Dropdown';
import ItemList from 'flarum/common/utils/ItemList';
import listItems from 'flarum/common/helpers/listItems';
import type Mithril from 'mithril';

import CanelaSidebar from '../../../components/CanelaSidebar';
import SidebarSection from '../../../components/SidebarSection';
import { t } from '../../../utils/settings';
import { aiInfo, aiUsable } from '../state';
import { CONVERSATIONS_ROUTE, CONVERSATION_ROUTE, isConversationsRoute } from './routes';
import { conversations, type AiConversation } from './ConversationsState';

/** Para onde o "sair do bot" volta: a última página fora das conversas. */
let lastForumUrl = '/';

function rememberForumUrl(): void {
  if (!isConversationsRoute()) lastForumUrl = window.location.pathname + window.location.search;
}

export default function installEntryPoints(): void {
  extend(HeaderSecondary.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    rememberForumUrl();

    if (!aiUsable('bot') || !aiInfo()?.botHeaderIcon) return;

    const inside = isConversationsRoute();
    const title = inside ? t('ai.bot.exit') : t('ai.bot.shortcut_title');

    items.add(
      'canelaAiBot',
      <LinkButton
        className="Button Button--flat Button--icon ai-bot-button"
        href={inside ? lastForumUrl : app.route(CONVERSATIONS_ROUTE)}
        icon={inside ? 'fas fa-shuffle' : 'fas fa-robot'}
        title={title}
        aria-label={title}
      />,
      15
    );
  });

  extend(CanelaSidebar.prototype, 'communityItems', function (items: ItemList<Mithril.Children>) {
    if (!aiUsable('bot') || !aiInfo()?.botSidebarLink) return;

    items.add(
      'canelaAiBot',
      <LinkButton href={app.route(CONVERSATIONS_ROUTE)} icon="fas fa-robot" title={t('ai.bot.shortcut_title')} active={isConversationsRoute()}>
        {t('ai.bot.shortcut_link')}
      </LinkButton>,
      58
    );
  });

  override(CanelaSidebar.prototype, 'sectionItems', function (this: CanelaSidebar, original: () => ItemList<Mithril.Children>) {
    if (!isConversationsRoute() || !aiUsable('bot')) return original();

    return conversationSections();
  });
}

function conversationSections(): ItemList<Mithril.Children> {
  const items = new ItemList<Mithril.Children>();

  conversations.loadList();

  if (!aiInfo()?.botHeaderIcon) {
    items.add(
      'back',
      <div className="sidebar-sections__back-to-forum CanelaAiSidebar-back">
        <LinkButton href={lastForumUrl} icon="fas fa-arrow-left">
          {t('ai.bot.back_to_forum')}
        </LinkButton>
      </div>,
      110
    );
  }

  items.add(
    'new',
    <div className="ai-new-question-button__wrapper">
      <Button
        className="Button ai-new-question-button"
        icon="fas fa-plus"
        onclick={() => {
          if (app.current.get('routeName') === CONVERSATIONS_ROUTE && conversations.currentId === null) {
            document.getElementById('ai-bot-conversations-input')?.focus();
          } else {
            m.route.set(app.route(CONVERSATIONS_ROUTE));
          }

          app.drawer.hide();
        }}
      >
        {t('ai.bot.new')}
      </Button>
    </div>,
    100
  );

  const groups = groupByDate(conversations.conversations);

  if (conversations.loaded && !groups.length) {
    items.add('empty', <div className="ai-bot-sidebar-empty-state">{t('ai.bot.sidebar_empty')}</div>, 90);
  }

  groups.forEach((group, index) => {
    items.add(
      `group-${group.key}`,
      <SidebarSection name={`ai-${group.key}`} title={group.title}>
        {listItems(group.items.map((conversation) => conversationLink(conversation)))}
      </SidebarSection>,
      90 - index
    );
  });

  if (conversations.hasMore) {
    items.add(
      'more',
      <div className="CanelaAiSidebar-more">
        <Button className="Button Button--link" loading={conversations.loading} onclick={() => conversations.loadList(true)}>
          {t('ai.bot.load_more')}
        </Button>
      </div>,
      -100
    );
  }

  return items;
}

function conversationLink(conversation: AiConversation): Mithril.Children {
  const active = conversations.currentId === conversation.id;

  return (
    <div className="CanelaAiSidebar-item">
      <LinkButton className="ai-conversation-sidebar__link" href={app.route(CONVERSATION_ROUTE, { id: conversation.id })} active={active}>
        {conversation.title || t('ai.bot.untitled')}
      </LinkButton>
      <Dropdown
        className="CanelaAiSidebar-menu"
        buttonClassName="Button Button--icon Button--flat"
        icon="fas fa-ellipsis"
        caretIcon={null}
        accessibleToggleLabel={t('ai.bot.conversation_menu')}
        menuClassName="Dropdown-menu--right"
      >
        <Button
          icon="fas fa-pencil"
          onclick={() => {
            const title = window.prompt(t('ai.bot.rename_prompt'), conversation.title || '');

            if (title && title.trim()) conversations.rename(conversation, title.trim()).catch(() => {});
          }}
        >
          {t('ai.bot.rename')}
        </Button>
        <Button
          icon="far fa-trash-can"
          onclick={() => {
            if (window.confirm(t('ai.bot.delete_confirm'))) conversations.remove(conversation).catch(() => {});
          }}
        >
          {t('ai.bot.delete')}
        </Button>
      </Dropdown>
    </div>
  );
}

interface ConversationGroup {
  key: string;
  title: string;
  items: AiConversation[];
}

/** Hoje · Últimos sete dias · Últimos 30 dias · e um grupo por mês. */
function groupByDate(list: AiConversation[]): ConversationGroup[] {
  const groups: ConversationGroup[] = [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;
  const monthFormat = new Intl.DateTimeFormat(app.translator.getLocale() || undefined, { month: 'long', year: 'numeric' });

  const groupFor = (date: Date): [string, string] => {
    const time = date.getTime();

    if (time >= startOfToday) return ['today', t('ai.bot.today')];
    if (time >= startOfToday - 7 * day) return ['last_7_days', t('ai.bot.last_7_days')];
    if (time >= startOfToday - 30 * day) return ['last_30_days', t('ai.bot.last_30_days')];

    const label = monthFormat.format(date);

    return [`${date.getFullYear()}-${date.getMonth()}`, label.charAt(0).toUpperCase() + label.slice(1)];
  };

  list.forEach((conversation) => {
    const [key, title] = groupFor(new Date(conversation.updatedAt || conversation.createdAt || Date.now()));
    let group = groups.find((item) => item.key === key);

    if (!group) {
      group = { key, title, items: [] };
      groups.push(group);
    }

    group.items.push(conversation);
  });

  return groups;
}
