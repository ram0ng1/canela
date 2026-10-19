/*
 * "Eu também" em tempo real com o flarum/realtime: quando outra pessoa marca
 * ou desmarca, o servidor publica `canelaMeToo` `{discussionId, count}` no
 * canal de cada conectado que vê o tópico (e no `public`, o dos visitantes,
 * se o tópico for público) — ver src/MeToo/Realtime/MeTooPushJob.php.
 *
 * Aqui a contagem nova entra no atributo `canelaMeToo` do tópico, o mesmo que
 * o clique local atualiza: o botão se redesenha pelo mesmo caminho, com o
 * mesmo rótulo "Eu também (N)". O "eu marquei" e o "posso marcar" de quem
 * recebe não mudam com o clique de outra pessoa, então ficam como estão.
 * Quem clicou não recebe o evento (o servidor o tira da lista): a contagem
 * dele vem da resposta do próprio pedido e não pula duas vezes.
 *
 * Os canais são do RealtimeState do flarum/realtime, que reexecuta os
 * callbacks a cada reconexão sobre os canais novos (sem ligar duas vezes).
 */
import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';

const ME_TOO_EVENT = 'canelaMeToo';

interface MeTooPush {
  discussionId?: string | number;
  count?: number;
}

interface ChannelLike {
  bind(event: string, callback: (data: unknown) => void): unknown;
}

/** Aplica um evento recebido: só a contagem muda. */
function applyMeTooPush(data: unknown): void {
  const push = (data || {}) as MeTooPush;
  const id = push.discussionId === undefined || push.discussionId === null ? '' : String(push.discussionId);
  const count = Number(push.count);

  if (!id || !Number.isFinite(count)) return;

  // Só o tópico que já está no store (aberto agora ou visitado nesta sessão).
  const discussion = app.store.getById<Discussion>('discussions', id);
  const current = discussion?.attribute<Record<string, unknown> | null>('canelaMeToo');

  // Sem o atributo o botão não existe ali (tag fora da lista, mensagem…).
  if (!discussion || !current || typeof current !== 'object' || current.count === count) return;

  discussion.pushAttributes({ canelaMeToo: { ...current, count: Math.max(0, Math.floor(count)) } });
  m.redraw();
}

export default function installMeTooRealtime(): void {
  if (!('flarum-realtime' in flarum.extensions)) return;

  const state = flarum.reg.get('flarum-realtime', 'forum/RealtimeState') as
    { onUserChannelReady?(cb: (channel: ChannelLike) => void): void; onPublicChannelReady?(cb: (channel: ChannelLike) => void): void } | undefined;

  // Logado só assina o canal privado; visitante, só o público.
  state?.onUserChannelReady?.((channel) => channel.bind(ME_TOO_EVENT, applyMeTooPush));
  state?.onPublicChannelReady?.((channel) => channel.bind(ME_TOO_EVENT, applyMeTooPush));
}
