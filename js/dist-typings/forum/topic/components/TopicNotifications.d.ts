import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Discussion from 'flarum/common/models/Discussion';
export type SubscriptionLevel = 'follow' | 'ignore' | null;
interface Level {
    value: SubscriptionLevel;
    key: 'watching' | 'normal' | 'muted';
    icon: string;
}
export declare const LEVELS: Level[];
export declare function currentLevel(discussion: Discussion): Level;
/**
 * O badge do flarum/subscriptions ao lado do título (⭐ "Seguindo", 👁
 * "Ignorando") com o ícone e o nome do nível escolhido no sino: o sino
 * tocando em "Acompanhando" e o cortado em "Silenciado". "Normal" continua
 * sem badge.
 */
export declare function installSubscriptionBadge(): void;
export interface TopicNotificationsAttrs extends ComponentAttrs {
    discussion: Discussion;
    /** Só o sino, redondo — a versão da linha do tempo. */
    compact?: boolean;
}
export default class TopicNotifications extends Component<TopicNotificationsAttrs> {
    view(): JSX.Element;
}
/** "Você receberá notificações porque…" — o texto embaixo do botão no rodapé. */
export declare function notificationReason(discussion: Discussion): string;
export {};
