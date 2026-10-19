/*
 * "Marcar não lido" que vale também depois de "marcar tudo como lido".
 *
 * O core conta como lido todo tópico sem post novo desde `markedAllAsReadAt`,
 * seja qual for o estado de leitura: marcado como não lido depois disso, ele
 * continuava aparecendo como lido. `canelaMarkedUnreadAt` (src/Topic/MarkUnread.php)
 * diz quando a pessoa o marcou; mais nova que "marcar tudo", o tópico volta a
 * contar como não lido — a mesma regra do filtro "Não lidos" no servidor.
 */
import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import Discussion from 'flarum/common/models/Discussion';

export default function installMarkUnread(): void {
  override(Discussion.prototype, 'unreadCount', function (this: Discussion, original: () => number): number {
    const user = app.session.user;
    const markedUnread = this.attribute<string | null>('canelaMarkedUnreadAt');
    const markedAll = user?.markedAllAsReadAt()?.getTime() ?? 0;

    if (!user || !markedUnread || new Date(markedUnread).getTime() <= markedAll) return original();

    // A conta do core, sem o corte de "marcar tudo como lido".
    const unread = Math.max(0, (this.lastPostNumber() ?? 0) - (this.lastReadPostNumber() || 0));

    return Math.min(unread, this.commentCount() ?? 0);
  });
}
