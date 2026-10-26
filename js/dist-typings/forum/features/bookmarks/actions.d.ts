import type Post from 'flarum/common/models/Post';
import type Discussion from 'flarum/common/models/Discussion';
import type Bookmark from './Bookmark';
/**
 * Os marcadores valem para quem está logado e com o recurso ligado. Sem o
 * atributo (o PHP do recurso não carregou), fica desligado: um botão que só
 * receberia 404 da API é pior do que nenhum.
 */
export declare function bookmarksEnabled(): boolean;
export interface PostBookmarkState {
    id: string;
    name: string | null;
    reminderAt: Date | null;
}
/** O marcador do ator neste post, como o PHP o descreveu (ou `null`). */
export declare function postBookmark(post: Post): PostBookmarkState | null;
/**
 * O marcador do post como registro do store, para salvar ou apagar. Quando o
 * post veio de uma página carregada antes (sem o marcador no store), o
 * registro é montado com o que o post já sabe — evita um GET só para isso.
 */
export declare function bookmarkRecord(post: Post): Bookmark | null;
export declare function isBusy(post: Post): boolean;
export interface BookmarkChanges {
    name?: string | null;
    /** `undefined` deixa como está; `null` tira o lembrete. */
    reminderAt?: Date | null;
}
/** Marca o post (ou atualiza o marcador, se já houver um). */
export declare function createBookmark(post: Post, changes?: BookmarkChanges): Promise<Bookmark>;
export declare function updateBookmark(post: Post, bookmark: Bookmark, changes: BookmarkChanges): Promise<Bookmark>;
export declare function deleteBookmark(post: Post, bookmark?: Bookmark | null): Promise<void>;
/** Zera os atributos do post depois de desmarcar. */
export declare function clearPost(post: Post): void;
/**
 * O primeiro post do tópico, que é o que "Marcar discussão" marca.
 * Tenta o store antes de ir à API: na página do tópico ele quase
 * sempre já está carregado.
 */
export declare function firstPostOf(discussion: Discussion): Promise<Post | null>;
