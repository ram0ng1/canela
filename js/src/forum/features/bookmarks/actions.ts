/*
 * As ações dos marcadores, num lugar só para o botão do post, o do tópico, o
 * modal e a página do perfil falarem a mesma língua com a API e o store.
 *
 * O post carrega o próprio estado (`bookmarkId`, `bookmarkName`,
 * `bookmarkReminderAt`, vindos do PHP): é ele que o botão lê. Criar e editar
 * devolvem o post incluído, e o store atualiza esses atributos sozinho;
 * apagar não devolve nada, então o post é zerado aqui.
 */
import app from 'flarum/forum/app';
import type Post from 'flarum/common/models/Post';
import type Discussion from 'flarum/common/models/Discussion';

import type Bookmark from './Bookmark';
import { forumBool } from '../../utils/settings';

/**
 * Os marcadores valem para quem está logado e com o recurso ligado. Sem o
 * atributo (o PHP do recurso não carregou), fica desligado: um botão que só
 * receberia 404 da API é pior do que nenhum.
 */
export function bookmarksEnabled(): boolean {
  return !!app.session.user && forumBool('canelaBookmarksEnabled', false);
}

export interface PostBookmarkState {
  id: string;
  name: string | null;
  reminderAt: Date | null;
}

/** O marcador do ator neste post, como o PHP o descreveu (ou `null`). */
export function postBookmark(post: Post): PostBookmarkState | null {
  const id = post.attribute<number | null | undefined>('bookmarkId');

  if (!id) return null;

  const reminder = post.attribute<string | null | undefined>('bookmarkReminderAt');

  return {
    id: String(id),
    name: post.attribute<string | null | undefined>('bookmarkName') ?? null,
    reminderAt: reminder ? new Date(reminder) : null,
  };
}

/**
 * O marcador do post como registro do store, para salvar ou apagar. Quando o
 * post veio de uma página carregada antes (sem o marcador no store), o
 * registro é montado com o que o post já sabe — evita um GET só para isso.
 */
export function bookmarkRecord(post: Post): Bookmark | null {
  const state = postBookmark(post);

  if (!state) return null;

  const existing = app.store.getById<Bookmark>('canela-bookmarks', state.id);

  if (existing) return existing;

  return app.store.pushObject<Bookmark>({
    type: 'canela-bookmarks',
    id: state.id,
    attributes: {
      name: state.name,
      reminderAt: state.reminderAt ? state.reminderAt.toISOString() : null,
    },
    relationships: { post: { data: { type: 'posts', id: post.id()! } } },
  } as any);
}

/** Posts com um pedido em andamento: um duplo clique não cria dois pedidos. */
const pending = new Set<string>();

export function isBusy(post: Post): boolean {
  return pending.has(post.id()!);
}

async function withBusy<T>(post: Post, task: () => Promise<T>): Promise<T> {
  pending.add(post.id()!);
  m.redraw();

  try {
    return await task();
  } finally {
    pending.delete(post.id()!);
    m.redraw();
  }
}

export interface BookmarkChanges {
  name?: string | null;
  /** `undefined` deixa como está; `null` tira o lembrete. */
  reminderAt?: Date | null;
}

function attributesFor(changes: BookmarkChanges): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  if (changes.name !== undefined) attributes.name = changes.name?.trim() || null;
  if (changes.reminderAt !== undefined) attributes.reminderAt = changes.reminderAt ? changes.reminderAt.toISOString() : null;

  return attributes;
}

/** Marca o post (ou atualiza o marcador, se já houver um). */
export function createBookmark(post: Post, changes: BookmarkChanges = {}): Promise<Bookmark> {
  return withBusy(post, () =>
    app.store.createRecord<Bookmark>('canela-bookmarks').save({
      ...attributesFor(changes),
      relationships: { post },
    } as any)
  );
}

export function updateBookmark(post: Post, bookmark: Bookmark, changes: BookmarkChanges): Promise<Bookmark> {
  return withBusy(post, () => bookmark.save(attributesFor(changes) as any));
}

export function deleteBookmark(post: Post, bookmark: Bookmark | null = bookmarkRecord(post)): Promise<void> {
  return withBusy(post, async () => {
    if (bookmark) await bookmark.delete();

    clearPost(post);
  });
}

/** Zera os atributos do post depois de desmarcar. */
export function clearPost(post: Post): void {
  post.pushAttributes({ bookmarked: false, bookmarkId: null, bookmarkName: null, bookmarkReminderAt: null });
}

/**
 * O primeiro post do tópico, que é o que "Marcar discussão" marca.
 * Tenta o store antes de ir à API: na página do tópico ele quase
 * sempre já está carregado.
 */
export async function firstPostOf(discussion: Discussion): Promise<Post | null> {
  const linkedId = (discussion.data.relationships as any)?.firstPost?.data?.id;
  const linked = linkedId ? app.store.getById<Post>('posts', linkedId) : undefined;

  if (linked) return linked;

  const inStore = app.store.all<Post>('posts').find((post) => post.discussion() === discussion && post.number() === 1);

  if (inStore) return inStore;

  const found = await app.store.find<Post[]>('posts', {
    filter: { discussion: discussion.id() },
    sort: 'number',
    page: { limit: 1, total: 0 },
  } as any);

  return found[0] ?? null;
}
