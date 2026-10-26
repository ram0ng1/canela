import type Mithril from 'mithril';
/** O endereço de cada aba: /notifications ou, no perfil, /u/:username/notifications. */
export type NotificationsHref = (filter: string) => string;
export default function NotificationsPageView(href?: NotificationsHref): Mithril.Children;
