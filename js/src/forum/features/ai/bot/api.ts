/*
 * As conversas com o bot pelo recurso JSON:API `canela-ai-conversations`
 * (com as mensagens, `canela-ai-messages`, só como inclusão).
 *
 * A página e a barra lateral trabalham com objetos simples (AiConversation,
 * AiMessage), e não com modelos do `app.store`: a resposta em streaming do bot
 * manda a conversa e as mensagens nesse mesmo formato, linha a linha, e as
 * duas origens se misturam na mesma lista. Aqui os documentos JSON:API viram
 * esses objetos.
 */
import app from 'flarum/forum/app';

import type { AiConversation, AiMessage } from './ConversationsState';

const TYPE = 'canela-ai-conversations';

interface ResourceObject {
  type: string;
  id: string;
  attributes: Record<string, any>;
  relationships?: Record<string, { data: { type: string; id: string }[] | { type: string; id: string } | null }>;
}

interface Document<T> {
  data: T;
  included?: ResourceObject[];
  links?: { next?: string };
}

function url(path = ''): string {
  return `${app.forum.attribute<string>('apiUrl')}/${TYPE}${path}`;
}

function toConversation(resource: ResourceObject): AiConversation {
  const attributes = resource.attributes;

  return {
    id: resource.id,
    title: attributes.title ?? null,
    persona: attributes.persona ?? null,
    messageCount: attributes.messageCount ?? 0,
    createdAt: attributes.createdAt ?? null,
    updatedAt: attributes.updatedAt ?? null,
  };
}

function toMessage(resource: ResourceObject): AiMessage {
  const attributes = resource.attributes;

  return {
    id: resource.id,
    role: attributes.role,
    content: attributes.content ?? '',
    tools: attributes.tools ?? [],
    model: attributes.model ?? null,
    createdAt: attributes.createdAt ?? null,
  };
}

/** Uma página da lista (50 por vez); `hasMore` vem do `links.next`. */
export function fetchConversations(offset: number): Promise<{ data: AiConversation[]; hasMore: boolean }> {
  return app
    .request<Document<ResourceObject[]>>({ method: 'GET', url: url(), params: { page: { offset } } })
    .then((document) => ({ data: document.data.map(toConversation), hasMore: !!document.links?.next }));
}

/** A conversa e as mensagens, na ordem em que o servidor as relaciona. */
export function fetchConversation(id: string): Promise<{ conversation: AiConversation; messages: AiMessage[] }> {
  return app.request<Document<ResourceObject>>({ method: 'GET', url: url(`/${id}`) }).then((document) => {
    const included = new Map((document.included ?? []).map((resource) => [`${resource.type}:${resource.id}`, resource]));
    const linkage = document.data.relationships?.messages?.data;
    const messages = (Array.isArray(linkage) ? linkage : [])
      .map((ref) => included.get(`${ref.type}:${ref.id}`))
      .filter((resource): resource is ResourceObject => !!resource)
      .map(toMessage);

    return { conversation: toConversation(document.data), messages };
  });
}

export function renameConversation(id: string, title: string): Promise<AiConversation> {
  return app
    .request<Document<ResourceObject>>({ method: 'PATCH', url: url(`/${id}`), body: { data: { type: TYPE, id, attributes: { title } } } })
    .then((document) => toConversation(document.data));
}

export function deleteConversation(id: string): Promise<void> {
  return app.request<void>({ method: 'DELETE', url: url(`/${id}`) });
}
