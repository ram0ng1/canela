/*
 * A barrinha de carregamento do topo (`.loading-indicator-container`): na
 * troca de página ela cresce até 80% no tempo médio das
 * últimas cinco navegações, segue devagar até 90% enquanto a página não
 * chega e, quando chega, completa e some.
 *
 * O Flarum não tem "transição de rota" com espera: a página nova monta na
 * hora e busca os dados no `oninit`. Então a navegação começa no `oninit` de
 * cada Page e termina quando as requisições disparadas naquele instante
 * voltam. Também cobre os módulos carregados sob demanda, que o core
 * anunciava com um alerta "Carregando…" — esse alerta sai.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Page from 'flarum/common/components/Page';

import { forumBool } from '../utils/settings';

// Os números da barra de carregamento.
const STORE_LOADING_TIMES = 5;
const DEFAULT_LOADING_TIME = 0.3;
const MIN_LOADING_TIME = 0.2;

type SliderState = 'ready' | 'loading' | 'still-loading' | 'done';

const durations: number[] = [];
let average = DEFAULT_LOADING_TIME;

let container: HTMLElement | null = null;
let bar: HTMLElement | null = null;
let state: SliderState = 'ready';
let deferred: number | null = null;

// Navegação em andamento: quando começou e quantas requisições dela faltam.
let loading = false;
let startedAt = 0;
let pending = 0;
// Módulos sob demanda em andamento (o "pool" do AlertManagerState).
let chunkPool = 0;
// A primeira página nasce com os dados do HTML: não é navegação.
let armed = false;

function record(seconds: number) {
  durations.push(seconds);
  if (durations.length > STORE_LOADING_TIMES) durations.shift();
  average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
}

function setState(next: SliderState) {
  state = next;

  if (!container) return;

  container.className = `CanelaLoadingSlider ${next}`;
  container.style.setProperty('--loading-duration', `${average.toFixed(2)}s`);
}

function mount() {
  if (container) return;

  container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  bar = document.createElement('div');
  bar.className = 'CanelaLoadingSlider-bar';
  container.appendChild(bar);
  document.body.appendChild(container);
  setState('ready');

  // Terminou de sumir: volta ao zero sem animar (o `.ready` não tem
  // transição na barra).
  container.addEventListener('transitionend', (event) => {
    if (event.target === container && event.propertyName === 'opacity' && state === 'done') {
      setState('ready');
    }
  });

  // Chegou aos 80% e a página ainda não veio: segue devagar até 90%.
  bar.addEventListener('transitionend', (event) => {
    if (event.target === bar && event.propertyName === 'transform' && state === 'loading') {
      setState('still-loading');
    }
  });
}

/** Começa uma navegação (ignorada se já houver uma em curso). */
export function startLoading() {
  if (loading || !enabled()) return;

  mount();
  loading = true;
  startedAt = performance.now();
  pending = 0;

  // Zera e, no quadro seguinte, cresce.
  if (deferred !== null) cancelAnimationFrame(deferred);
  setState('ready');
  deferred = requestAnimationFrame(() => {
    deferred = null;
    if (loading) setState('loading');
  });
}

/** Termina a navegação: a barra completa e some. */
export function endLoading() {
  if (!loading) return;

  loading = false;
  record(Math.max((performance.now() - startedAt) / 1000, MIN_LOADING_TIME));

  if (deferred !== null) {
    cancelAnimationFrame(deferred);
    deferred = null;
  }

  // Se nem chegou a aparecer (página instantânea), o `.done` fica invisível.
  setState('done');
}

/** Lida na hora: no install o `app.forum` ainda não existe. */
function enabled(): boolean {
  return !!app.forum && forumBool('canelaLoadingSlider', true);
}

function settle() {
  pending = Math.max(0, pending - 1);
  if (pending === 0 && chunkPool === 0) endLoading();
}

export default function installLoadingSlider() {
  extend(app as any, 'mount', () => {
    // Arma depois do primeiro desenho: a página inicial não é navegação.
    requestAnimationFrame(() => window.setTimeout(() => (armed = true), 300));
  });

  // Cada página nova é uma navegação. O `oninit` da Page roda antes do da
  // subclasse, que é quem dispara as buscas — por isso a checagem espera o
  // desenho: se nada foi pedido até lá, a página já estava pronta.
  extend(Page.prototype, 'oninit', () => {
    if (!armed) return;

    startLoading();
    requestAnimationFrame(() =>
      window.setTimeout(() => {
        if (pending === 0 && chunkPool === 0) endLoading();
      }, 0)
    );
  });

  // Conta as requisições que nascem durante a navegação. O override nunca
  // pode falhar: se falhar, o `request` do app devolveria undefined.
  override(app as any, 'request', function (this: unknown, original: (...args: unknown[]) => Promise<unknown>, ...args: unknown[]) {
    const promise = original(...args);

    try {
      if (loading && promise && typeof (promise as Promise<unknown>).then === 'function') {
        pending++;
        (promise as Promise<unknown>).then(settle, settle);
      }
    } catch {
      // A contagem é cosmética; a requisição segue de qualquer jeito.
    }

    return promise;
  });

  // Módulos sob demanda: a barra no lugar do alerta "Carregando…".
  const alerts = app.alerts as any;

  // Desligada a barra, o alerta do core volta.
  let coreLoads = 0;

  override(alerts, 'showLoading', (original: () => void) => {
    if (!enabled()) {
      coreLoads++;
      return original();
    }

    chunkPool++;
    if (armed) startLoading();
  });

  override(alerts, 'clearLoading', (original: () => void) => {
    if (coreLoads > 0) {
      coreLoads--;
      return original();
    }

    if (chunkPool === 0) return;
    chunkPool--;
    if (chunkPool === 0 && pending === 0) endLoading();
  });
}
