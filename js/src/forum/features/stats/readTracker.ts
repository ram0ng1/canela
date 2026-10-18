/*
 * O "timings" do Discourse, simplificado: enquanto o tópico está na tela e a
 * pessoa está de fato ali (aba visível, mexeu na página há pouco), conta os
 * segundos de leitura e as postagens que ficaram tempo bastante à vista, e
 * manda os dois para o servidor a cada 30 segundos.
 *
 * O servidor desconfia de tudo (veja RecordReadTimeController); aqui o
 * cuidado é só não contar tempo de aba esquecida aberta.
 */
import { extend } from 'flarum/common/extend';
import app from 'flarum/forum/app';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';

import { forumBool } from '../../utils/settings';
import { sendReadTime } from './api';

const TICK_MS = 1000;

/** De quanto em quanto tempo os segundos acumulados vão para o servidor. */
const FLUSH_EVERY_TICKS = 30;

/** Sem mexer na página por 3 minutos, a pessoa saiu de perto (o mesmo do Discourse). */
const IDLE_AFTER_MS = 3 * 60 * 1000;

/** Uma postagem conta como lida depois de 2 segundos à vista. */
const POST_READ_SECONDS = 2;

/** O servidor aceita até 50 por envio; o resto espera o próximo. */
const MAX_POSTS_PER_FLUSH = 50;

const ACTIVITY_EVENTS = ['scroll', 'wheel', 'keydown', 'mousemove', 'pointerdown', 'touchstart'];

export class ReadTracker {
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastActivity = Date.now();
  private ticks = 0;
  private seconds = 0;
  private discussionId: string | null = null;

  /** id da postagem → segundos à vista, até virar lida. */
  private exposure = new Map<string, number>();
  private pending = new Set<string>();
  /** Já enviadas nesta visita à página: não contam duas vezes. */
  private sent = new Set<string>();

  constructor(private readonly currentDiscussionId: () => string | null) {}

  private readonly onActivity = () => {
    this.lastActivity = Date.now();
  };

  private readonly onVisibility = () => {
    // A aba saindo de vista pode ser a última chance de enviar (o celular
    // congela a página logo depois); o keepalive do fetch garante a entrega.
    if (document.visibilityState === 'hidden') this.flush();
  };

  start(): void {
    if (this.interval) return;

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, this.onActivity, { passive: true }));
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onVisibility);

    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (!this.interval) return;

    clearInterval(this.interval);
    this.interval = null;

    ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, this.onActivity));
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onVisibility);

    this.flush();
  }

  private tick(): void {
    const id = this.currentDiscussionId();

    // A DiscussionPage é reaproveitada ao ir de um tópico a outro: o que foi
    // juntado no anterior vai embora com o id dele antes de recomeçar.
    if (id !== this.discussionId) {
      this.flush();
      this.discussionId = id;
      this.exposure.clear();
      this.sent.clear();
    }

    if (!id || document.visibilityState !== 'visible' || Date.now() - this.lastActivity > IDLE_AFTER_MS) return;

    this.seconds++;
    this.collectVisiblePosts();

    if (++this.ticks >= FLUSH_EVERY_TICKS) this.flush();
  }

  private collectVisiblePosts(): void {
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    document.querySelectorAll<HTMLElement>('.PostStream-item[data-id]').forEach((element) => {
      const postId = element.dataset.id;

      if (!postId || this.sent.has(postId) || this.pending.has(postId)) return;

      const rect = element.getBoundingClientRect();

      if (rect.bottom <= 0 || rect.top >= viewportHeight || rect.height === 0) return;

      const seconds = (this.exposure.get(postId) || 0) + 1;

      if (seconds >= POST_READ_SECONDS) {
        this.exposure.delete(postId);
        this.pending.add(postId);
      } else {
        this.exposure.set(postId, seconds);
      }
    });
  }

  flush(): void {
    this.ticks = 0;

    const discussionId = this.discussionId;

    if (!discussionId || (this.seconds <= 0 && this.pending.size === 0)) {
      this.seconds = 0;
      return;
    }

    const postIds = Array.from(this.pending).slice(0, MAX_POSTS_PER_FLUSH);

    postIds.forEach((id) => {
      this.pending.delete(id);
      this.sent.add(id);
    });

    sendReadTime({ discussionId, seconds: this.seconds, postIds });

    this.seconds = 0;
  }
}

export function activityEnabled(): boolean {
  return !!app.session.user && forumBool('canelaStatsActivityEnabled', true);
}

const trackers = new WeakMap<DiscussionPage, ReadTracker>();

export default function installReadTracker(): void {
  extend(DiscussionPage.prototype, 'oncreate', function (this: DiscussionPage) {
    if (!activityEnabled()) return;

    const tracker = new ReadTracker(() => this.discussion?.id() ?? null);

    trackers.set(this, tracker);
    tracker.start();
  });

  extend(DiscussionPage.prototype, 'onremove', function (this: DiscussionPage) {
    trackers.get(this)?.stop();
    trackers.delete(this);
  });
}
