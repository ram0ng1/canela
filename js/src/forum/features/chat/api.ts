/*
 * A API do chat: os recursos JSON:API `chat-channels`, `chat-messages` e
 * `chat-threads` (extend/chat.php), com as ações deles, a busca de pessoas
 * (`/users/canela-chat-search`) e o envio de imagens (`/chat/uploads`).
 *
 * O chat continua trabalhando com objetos simples (types.ts), e não com
 * modelos do store: ele muda o tempo todo (mensagens, reações, contagens) e o
 * front mexe neles direto a cada evento. Por isso cada chamada daqui devolve
 * o documento já como esses objetos — o id e os atributos lado a lado —, e
 * os usuários do `included` vão para o store do Flarum (Avatar, nome,
 * perfil), como antes.
 *
 * Os parâmetros da URL vão em `filter[…]` e `page[…]`: o servidor JSON:API
 * recusa os nomes soltos (`?q=`).
 */
import app from 'flarum/forum/app';

import type { ChatChannel, ChatMessage, ChatThread, ChatUpload, NotificationLevel, ThreadLevel } from './types';

type Resource = { type: string; id: string; attributes?: Record<string, any>; relationships?: Record<string, { data?: any }> };
type Document = { data: Resource | Resource[] | null; included?: Resource[]; meta?: Record<string, any>; links?: Record<string, string> };
type Options = Record<string, unknown>;

const CHANNELS = 'chat-channels';
const MESSAGES = 'chat-messages';
const THREADS = 'chat-threads';

/** Sem alerta de erro: para as chamadas de fundo (estado, polling, "lido"). */
export const quiet: Options = { errorHandler: () => {} };

function apiBase(): string {
  return (app.forum.attribute<string>('apiUrl') || '/api').replace(/\/+$/, '');
}

function clean(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) return undefined;

  const out: Record<string, unknown> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (typeof value === 'object' && !Array.isArray(value)) {
      const nested = clean(value as Record<string, unknown>);

      if (nested && Object.keys(nested).length) out[key] = nested;
    } else {
      out[key] = value;
    }
  });

  return out;
}

async function request<T = Document>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, unknown>,
  options: Options = {}
): Promise<T> {
  const result = await app.request<T>({
    method,
    url: apiBase() + path,
    body: body as any,
    params: clean(params),
    ...(body instanceof FormData ? { serialize: (raw: FormData) => raw } : {}),
    ...options,
  } as any);

  if (result && typeof result === 'object' && 'data' in (result as any)) absorbUsers(result as unknown as Document);

  return result;
}

/** Os usuários do documento (no `data` ou no `included`) vão para o store. */
function absorbUsers(doc: Document): void {
  const primary = Array.isArray(doc.data) ? doc.data : doc.data ? [doc.data] : [];

  [...primary, ...(doc.included || [])].filter((resource) => resource.type === 'users').forEach((resource) => app.store.pushObject(resource as any));
}

/** O recurso como objeto simples; o `channelType` (o `type` é reservado no JSON:API) volta a ser o `type` do canal. */
function plain<T>(resource: Resource): T {
  const item: Record<string, any> = { id: Number(resource.id), ...(resource.attributes || {}) };

  if ('channelType' in item) {
    item.type = item.channelType;
    delete item.channelType;
  }

  return item as T;
}

function list(doc: Document): Resource[] {
  return Array.isArray(doc.data) ? doc.data : doc.data ? [doc.data] : [];
}

function included<T>(doc: Document, type: string): T[] {
  return (doc.included || []).filter((resource) => resource.type === type).map((resource) => plain<T>(resource));
}

function thread(doc: Document, resource: Resource): ChatThread {
  const item = plain<ChatThread>(resource);
  const original = resource.relationships?.originalMessage?.data;
  const message = original ? (doc.included || []).find((r) => r.type === MESSAGES && r.id === original.id) : null;

  item.originalMessage = message ? plain<ChatMessage>(message) : null;

  return item;
}

function write(type: string, attributes: Record<string, unknown>, relationships?: Record<string, unknown>) {
  return { data: { type, attributes, ...(relationships ? { relationships } : {}) } };
}

const one = <T>(doc: Document): T => plain<T>(list(doc)[0]);
const many = <T>(doc: Document): T[] => list(doc).map((resource) => plain<T>(resource));

// ─── Canais ─────────────────────────────────────────────────────────────────

export async function state(options: Options = {}): Promise<{ channels: ChatChannel[] }> {
  return { channels: many(await request('GET', `/${CHANNELS}/state`, undefined, undefined, options)) };
}

export async function browse(filter: { status?: string; q?: string }, offset = 0): Promise<{ channels: ChatChannel[]; hasMore: boolean }> {
  const doc = await request('GET', `/${CHANNELS}`, undefined, { filter, page: { offset: offset || undefined } });

  return { channels: many(doc), hasMore: !!doc.links?.next };
}

export async function channel(id: number, options: Options = {}): Promise<{ channel: ChatChannel }> {
  return { channel: one(await request('GET', `/${CHANNELS}/${id}`, undefined, undefined, options)) };
}

export async function createChannel(attributes: Record<string, unknown>): Promise<{ channel: ChatChannel }> {
  return { channel: one(await request('POST', `/${CHANNELS}`, write(CHANNELS, attributes))) };
}

export async function updateChannel(id: number, attributes: Record<string, unknown>): Promise<{ channel: ChatChannel }> {
  return { channel: one(await request('PATCH', `/${CHANNELS}/${id}`, write(CHANNELS, attributes))) };
}

export async function deleteChannel(id: number): Promise<void> {
  await request('DELETE', `/${CHANNELS}/${id}`);
}

/** Abre (ou reabre) a MD com essas pessoas; com `name`, um chat em grupo novo. */
export async function openDirect(userIds: number[], name?: string): Promise<{ channel: ChatChannel }> {
  return { channel: one(await request('POST', `/${CHANNELS}/direct`, { userIds, name: name || undefined })) };
}

export async function follow(id: number): Promise<{ channel: ChatChannel }> {
  return { channel: one(await request('POST', `/${CHANNELS}/${id}/membership`)) };
}

export async function updateMembership(
  id: number,
  attributes: { muted?: boolean; starred?: boolean; notificationLevel?: NotificationLevel }
): Promise<{ channel: ChatChannel }> {
  return { channel: one(await request('PATCH', `/${CHANNELS}/${id}/membership`, attributes)) };
}

/** Sair do canal; de um grupo de MD, o canal some (e a resposta vem vazia). */
export async function leave(id: number): Promise<{ channel: ChatChannel | null }> {
  const doc = await request<Document | null>('DELETE', `/${CHANNELS}/${id}/membership`);

  return { channel: doc?.data ? one(doc) : null };
}

export async function members(id: number, q: string, offset = 0): Promise<{ memberIds: number[]; hasMore: boolean; total: number }> {
  const doc = await request('GET', `/${CHANNELS}/${id}/members`, undefined, { filter: { q }, page: { offset: offset || undefined } });

  return { memberIds: list(doc).map((user) => Number(user.id)), hasMore: !!doc.meta?.hasMore, total: Number(doc.meta?.total || 0) };
}

export async function addMembers(id: number, userIds: number[]): Promise<{ channel: ChatChannel }> {
  return { channel: one(await request('POST', `/${CHANNELS}/${id}/members`, { userIds })) };
}

export async function markRead(id: number, messageId?: number, options: Options = {}): Promise<{ channel: ChatChannel }> {
  return { channel: one(await request('POST', `/${CHANNELS}/${id}/read`, { messageId }, undefined, options)) };
}

export async function typing(id: number, isTyping: boolean, threadId: number | null): Promise<void> {
  await request('POST', `/${CHANNELS}/${id}/typing`, { typing: isTyping, threadId }, undefined, quiet);
}

export async function pins(id: number, options: Options = {}): Promise<{ messages: ChatMessage[] }> {
  return { messages: many(await request('GET', `/${CHANNELS}/${id}/pins`, undefined, undefined, options)) };
}

export async function pinsRead(id: number): Promise<void> {
  await request('POST', `/${CHANNELS}/${id}/pins-read`, undefined, undefined, quiet);
}

/** O polling sem websocket: as novas, as que mudaram, as que sumiram e quem está digitando. */
export async function updates(
  id: number,
  filter: { after?: number; since?: string | null; thread?: number | null }
): Promise<{ messages: ChatMessage[]; changed: ChatMessage[]; removedIds: number[]; typingUserIds: number[]; now: string }> {
  const doc = await request('GET', `/${CHANNELS}/${id}/updates`, undefined, { filter }, quiet);
  const all = many<ChatMessage>(doc);
  const fresh = new Set<number>(doc.meta?.newIds || []);

  return {
    messages: all.filter((message) => fresh.has(message.id)),
    changed: all.filter((message) => !fresh.has(message.id)),
    removedIds: doc.meta?.removedIds || [],
    typingUserIds: doc.meta?.typingUserIds || [],
    now: doc.meta?.now,
  };
}

// ─── Mensagens ──────────────────────────────────────────────────────────────

export type MessagesMeta = { canLoadMorePast: boolean; canLoadMoreFuture: boolean; targetMessageId: number | null };

/** Uma página de mensagens por cursor (`around`, `before` ou `after`). */
export async function messages(
  channelId: number,
  page: { around?: number | null; before?: number; after?: number; limit?: number },
  threadId?: number | null
): Promise<{ messages: ChatMessage[]; meta: MessagesMeta }> {
  const doc = await request('GET', `/${MESSAGES}`, undefined, { filter: { channel: channelId, thread: threadId || undefined }, page });

  return { messages: many(doc), meta: doc.meta as MessagesMeta };
}

export async function sendMessage(
  channelId: number,
  attributes: { message: string; inReplyToId: number | null; threadId: number | null; uploadIds: number[] },
  options: Options = {}
): Promise<{ message: ChatMessage }> {
  const body = write(MESSAGES, attributes, { channel: { data: { type: CHANNELS, id: String(channelId) } } });

  return { message: one(await request('POST', `/${MESSAGES}`, body, undefined, options)) };
}

export async function message(id: number, options: Options = {}): Promise<{ message: ChatMessage }> {
  return { message: one(await request('GET', `/${MESSAGES}/${id}`, undefined, undefined, options)) };
}

export async function updateMessage(id: number, attributes: { message: string; uploadIds: number[] }): Promise<{ message: ChatMessage }> {
  return { message: one(await request('PATCH', `/${MESSAGES}/${id}`, write(MESSAGES, attributes))) };
}

/** Apagar é brando: a resposta é a mensagem como ficou (recolhida para o autor e a moderação). */
export async function deleteMessage(id: number): Promise<{ message: ChatMessage }> {
  return { message: one(await request('DELETE', `/${MESSAGES}/${id}`)) };
}

export async function restoreMessage(id: number): Promise<{ message: ChatMessage }> {
  return { message: one(await request('POST', `/${MESSAGES}/${id}/restore`)) };
}

export async function react(id: number, emoji: string, action: 'add' | 'remove'): Promise<{ message: ChatMessage }> {
  return { message: one(await request('POST', `/${MESSAGES}/${id}/reactions`, { emoji, action })) };
}

export async function pin(id: number, value: boolean): Promise<{ message: ChatMessage }> {
  return { message: one(await request(value ? 'POST' : 'DELETE', `/${MESSAGES}/${id}/pin`)) };
}

/** "Pesquisar no chat": os resultados e os canais deles. */
export async function search(q: string, sort: string, channelId?: number): Promise<{ results: ChatMessage[]; channels: ChatChannel[] }> {
  const doc = await request('GET', `/${MESSAGES}/search`, undefined, {
    filter: { q, channel: channelId },
    sort: sort === 'latest' ? '-createdAt' : undefined,
  });

  return { results: many(doc), channels: included(doc, CHANNELS) };
}

// ─── Fios ───────────────────────────────────────────────────────────────────

/** Os fios de um canal, ou — sem canal — os que o leitor acompanha, com os canais deles. */
export async function threads(channelId?: number): Promise<{ threads: ChatThread[]; channels: ChatChannel[] }> {
  const doc = await request('GET', `/${THREADS}`, undefined, { filter: { channel: channelId } });

  return { threads: list(doc).map((resource) => thread(doc, resource)), channels: included(doc, CHANNELS) };
}

export async function fetchThread(id: number): Promise<{ thread: ChatThread }> {
  const doc = await request('GET', `/${THREADS}/${id}`);

  return { thread: thread(doc, list(doc)[0]) };
}

export async function updateThread(
  id: number,
  attributes: { title?: string | null; notificationLevel?: ThreadLevel }
): Promise<{ thread: ChatThread }> {
  const doc = await request('PATCH', `/${THREADS}/${id}`, write(THREADS, attributes));

  return { thread: thread(doc, list(doc)[0]) };
}

export async function markThreadRead(id: number, messageId?: number, options: Options = {}): Promise<{ thread: ChatThread }> {
  const doc = await request('POST', `/${THREADS}/${id}/read`, { messageId }, undefined, options);

  return { thread: thread(doc, list(doc)[0]) };
}

// ─── Pessoas e imagens ──────────────────────────────────────────────────────

/** A busca de pessoas do chat (o `@` e "Nova mensagem"); com o canal, quem é membro. */
export async function users(q: string, channelId?: number): Promise<{ userIds: number[]; memberIds: number[] }> {
  const doc = await request('GET', '/users/canela-chat-search', undefined, { filter: { q, channel: channelId } }, quiet);

  return { userIds: list(doc).map((user) => Number(user.id)), memberIds: doc.meta?.memberIds || [] };
}

/** Envia uma imagem do composer (multipart): ela fica solta até a mensagem sair. */
export async function upload(file: File): Promise<{ upload: ChatUpload }> {
  const body = new FormData();
  body.append('file', file);

  return request<{ upload: ChatUpload }>('POST', '/chat/uploads', body);
}
