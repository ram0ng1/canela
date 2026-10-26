import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
export default function installBookmarks(): void;
/**
 * Num post sem marcador, marca e avisa — com o atalho "Definir lembrete" no
 * próprio aviso, para definir o lembrete logo depois de marcar. Num post marcado, abre o modal.
 */
export declare function togglePostBookmark(post: Post): void;
/** Marca (ou edita) o primeiro post do tópico. */
export declare function toggleTopicBookmark(discussion: Discussion): Promise<void>;
export declare function topicIsBookmarked(discussion: Discussion): boolean;
