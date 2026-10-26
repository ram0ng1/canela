import Notification from 'flarum/forum/components/Notification';
/**
 * 'Ganhou "Primeira curtida"' — a notificação de emblema concedido. O avatar é o
 * da própria pessoa (o servidor manda ela como remetente), com o ícone de
 * emblema no canto.
 */
export default class BadgeGrantedNotification extends Notification {
    icon(): string;
    href(): string;
    content(): string;
    excerpt(): string | null;
}
