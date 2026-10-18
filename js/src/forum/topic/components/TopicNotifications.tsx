/*
 * O controle de notificações do tópico no jeito do Discourse: um botão com o
 * sino do nível atual e um menu em que cada nível tem título e descrição.
 *
 * Os níveis são os três do flarum/subscriptions (seguir, normal, ignorar),
 * com os nomes do Discourse: Acompanhando, Normal e Silenciado. O tema não usa
 * o SubscriptionMenu da extensão porque o botão dele é dividido (seguir com um
 * clique + seta), e no Discourse o clique sempre abre o menu.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Dropdown from 'flarum/common/components/Dropdown';
import DetailedDropdownItem from 'flarum/common/components/DetailedDropdownItem';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';

import { t } from '../../utils/settings';

export type SubscriptionLevel = 'follow' | 'ignore' | null;

interface Level {
  value: SubscriptionLevel;
  key: 'watching' | 'normal' | 'muted';
  icon: string;
}

export const LEVELS: Level[] = [
  { value: 'follow', key: 'watching', icon: 'fas fa-bell' },
  { value: null, key: 'normal', icon: 'far fa-bell' },
  { value: 'ignore', key: 'muted', icon: 'fas fa-bell-slash' },
];

export function currentLevel(discussion: Discussion): Level {
  const value = ((discussion as any).subscription?.() ?? null) as SubscriptionLevel;

  return LEVELS.find((level) => level.value === value) || LEVELS[1];
}

export interface TopicNotificationsAttrs extends ComponentAttrs {
  discussion: Discussion;
  /** Só o sino, redondo — a versão da linha do tempo. */
  compact?: boolean;
}

export default class TopicNotifications extends Component<TopicNotificationsAttrs> {
  view() {
    const discussion = this.attrs.discussion;
    const current = currentLevel(discussion);

    return (
      <Dropdown
        className={classList('CanelaNotifications', `CanelaNotifications--${current.key}`, { 'CanelaNotifications--compact': this.attrs.compact })}
        buttonClassName={classList('Button CanelaNotifications-button', { 'Button--icon': this.attrs.compact })}
        menuClassName="CanelaNotifications-menu"
        icon={current.icon}
        // Sino cheio x vazado é o que distingue "Acompanhando" de "Normal": o
        // estilo de ícone forçado pelo fórum não pode igualar os dois.
        noStyleOverride
        label={this.attrs.compact ? '' : t(`topic.notifications.${current.key}`)}
        caretIcon={this.attrs.compact ? '' : 'fas fa-caret-down'}
        accessibleToggleLabel={t('topic.notifications.toggle', { level: t(`topic.notifications.${current.key}`) })}
        tooltip={this.attrs.compact ? t(`topic.notifications.${current.key}`) : undefined}
      >
        {LEVELS.map((level) => (
          <DetailedDropdownItem
            icon={<Icon name={level.icon} className="Button-icon" noStyleOverride />}
            label={t(`topic.notifications.${level.key}`)}
            description={t(`topic.notifications.${level.key}_description`)}
            active={level.value === current.value}
            onclick={() => {
              if (level.value !== current.value) discussion.save({ subscription: level.value });
            }}
          />
        ))}
      </Dropdown>
    );
  }
}

/** "Você receberá notificações porque…" — o texto embaixo do botão no rodapé. */
export function notificationReason(discussion: Discussion): string {
  return t(`topic.notifications.${currentLevel(discussion).key}_reason`);
}
