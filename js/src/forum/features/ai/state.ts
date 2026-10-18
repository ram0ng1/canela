/*
 * O estado da IA que o servidor manda (`canelaAi`, por pessoa) e os
 * atalhos para os pedidos à API — os comuns (JSON) e os que chegam em
 * streaming (NDJSON, uma linha por evento).
 *
 * `canelaAi` é null quando a IA está desligada, sem provedor ou sem as
 * tabelas: aí nada de IA aparece no fórum.
 */
import app from 'flarum/forum/app';

export interface AiPersona {
  id: string;
  name: string;
  description: string;
}

export interface AiInfo {
  bot: boolean;
  botHeaderIcon: boolean;
  botSidebarLink: boolean;
  search: boolean;
  helper: boolean;
  summary: boolean;
  gists: boolean;
  related: boolean;
  canUse: boolean;
  canSummarize: boolean;
  remaining: number | null;
  personas: AiPersona[];
  defaultPersona: string | null;
  model: string;
}

export type AiFeature = 'bot' | 'search' | 'helper' | 'summary' | 'gists' | 'related';

export function aiInfo(): AiInfo | null {
  return (app.forum?.attribute<AiInfo | null>('canelaAi') as AiInfo | null) ?? null;
}

/** O recurso vale para todos (resumos prontos, gists, relacionados). */
export function aiFeature(feature: AiFeature): boolean {
  return !!aiInfo()?.[feature];
}

/** O recurso vale e a pessoa pode usá-lo (bot, busca, ajudante). */
export function aiUsable(feature: 'bot' | 'search' | 'helper'): boolean {
  const info = aiInfo();

  return !!info && !!info[feature] && info.canUse && !!app.session.user;
}

export function aiApiUrl(path: string): string {
  return `${app.forum.attribute<string>('apiUrl')}/canela/ai/${path}`;
}

export function aiRequest<T = any>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: Record<string, unknown>): Promise<T> {
  return app.request<T>({ method, url: aiApiUrl(path), body });
}

export interface StreamLine {
  type: string;
  [key: string]: any;
}

/**
 * POST que lê a resposta enquanto ela é escrita.
 *
 * O `app.request` só entrega o corpo inteiro, no fim; aqui cada linha (um
 * objeto JSON completo) vai para `onLine` assim que chega — é o que dá o
 * efeito de "digitando" do Discourse. Um erro antes do stream (422 do limite,
 * 403…) vira uma exceção com a mensagem da API, para o alerta.
 */
export async function aiStream(path: string, body: Record<string, unknown>, onLine: (line: StreamLine) => void, signal?: AbortSignal): Promise<void> {
  const response = await fetch(aiApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
      'X-CSRF-Token': app.session.csrfToken,
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    let message = '';

    try {
      const data = await response.json();
      message = data?.errors?.[0]?.detail || '';
    } catch {
      // Corpo que não é JSON: fica a mensagem genérica.
    }

    throw new AiStreamError(response.status, message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';

  for (;;) {
    const { done, value } = await reader.read();

    if (done) break;

    buffered += decoder.decode(value, { stream: true });

    // O que vem depois da última quebra de linha é meia linha: espera o
    // próximo pedaço.
    const lines = buffered.split('\n');
    buffered = lines.pop() ?? '';

    for (const line of lines) {
      if (line.trim() === '') continue;

      try {
        onLine(JSON.parse(line));
      } catch (error) {
        console.warn('[canela] linha inválida no stream da IA', error);
      }
    }
  }

  if (buffered.trim() !== '') {
    try {
      onLine(JSON.parse(buffered));
    } catch {
      // Uma linha cortada no fim (conexão caiu) não tem o que mostrar.
    }
  }
}

export class AiStreamError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/** O alerta de erro de um pedido à IA, com a mensagem da API quando houver. */
export function showAiError(error: unknown): void {
  if ((error as any)?.name === 'AbortError') return;

  const message = error instanceof AiStreamError ? error.message : (error as any)?.response?.errors?.[0]?.detail;

  // Os erros do app.request já viram alerta sozinhos; os do fetch, não.
  if (error instanceof AiStreamError || !(error as any)?.alert) {
    app.alerts.show({ type: 'error' }, message || app.translator.trans('ramon-canela.forum.ai.errors.generic'));
  }
}
