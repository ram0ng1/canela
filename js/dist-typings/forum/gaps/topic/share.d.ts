import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
/** Compartilhar o tópico (ou um post dele): janela no computador, folha do sistema no celular. */
export declare function openShare(discussion: Discussion, post?: Post | null): void;
