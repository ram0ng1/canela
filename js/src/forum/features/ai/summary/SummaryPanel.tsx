/*
 * O painel "Resumo da discussão": flutua à
 * direita, logo abaixo do cabeçalho, entra deslizando e não escurece a página
 * — dá para ler o tópico com ele aberto.
 *
 * - Enquanto o modelo começa: os blocos cinza que aparecem e piscam e o
 *   "Resumindo tópico usando IA…" com os pontinhos.
 * - Depois, o resumo chegando em streaming, com o "●" no fim.
 * - No pé: "Resumo feito com a IA em <data>" (o modelo no ⓘ), o aviso de
 *   desatualizado com as postagens que faltam, e "Gerar novamente".
 *
 * Montado num elemento próprio do <body>, fora da árvore da página: trocar de
 * tópico ou rolar não o recria.
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import { fullDate } from '../../../utils/dates';
import { aiInfo, aiStream, showAiError } from '../state';
import Cooked from '../Cooked';
import { blinkingAnimation, indicatorWave } from '../ui';

interface SummaryData {
  text: string;
  updatedAt: string | null;
  model: string | null;
  outdated: boolean;
  newPostsSinceSummary: number;
  canRegenerate: boolean;
}

/** A digitação suave: um caractere a cada 15 ms… */
const TYPING_DELAY = 15;
/** …e, quando o resumo pronto chega inteiro, o texto em 12 passos. */
const COMPLETION_CATCH_UP_STEPS = 12;
/**
 * Gerando, o texto continua sendo digitado mesmo que o resto chegue de uma
 * vez (um proxy que segura a resposta entrega tudo no fim): no máximo uns 3 s
 * para o que faltar, um caractere por vez quando dá.
 */
const MAX_TYPING_TICKS = 200;

class SummaryState {
  discussion: Discussion | null = null;
  open = false;
  closing = false;
  loading = false;
  /** O "●" no fim e o rodapé escondido: enquanto o texto ainda está aparecendo. */
  streaming = false;
  /** O que já aparece na tela. */
  text = '';
  /** Tudo o que chegou do servidor; `text` corre atrás dele. */
  target = '';
  /** O resumo completo já chegou. */
  completed = false;
  /** Chegaram pedaços da geração (e não só o resumo pronto). */
  generated = false;
  timer: ReturnType<typeof setTimeout> | null = null;
  summary: SummaryData | null = null;
  controller: AbortController | null = null;

  show(discussion: Discussion): void {
    const sameTopic = this.discussion === discussion;

    this.discussion = discussion;
    this.open = true;
    this.closing = false;
    mountPanel();

    if (sameTopic && (this.summary || this.streaming || this.loading)) return m.redraw();

    this.reset();
    this.request(false);
  }

  hide(): void {
    if (!this.open) return;

    // A saída também é animada (float-out-right): o painel some depois dela.
    this.closing = true;
    m.redraw();

    setTimeout(() => {
      if (!this.closing) return;
      this.open = false;
      this.closing = false;
      m.redraw();
    }, 250);
  }

  reset(): void {
    this.controller?.abort();
    this.controller = null;
    this.stopTyping();
    this.text = '';
    this.target = '';
    this.completed = false;
    this.generated = false;
    this.summary = null;
    this.loading = false;
    this.streaming = false;
  }

  /**
   * O texto aparece letra a letra: os pedaços do modelo
   * chegam aos trancos (às vezes uma frase inteira de uma vez), e o resumo já
   * pronto chegava inteiro, sem animação nenhuma.
   */
  receive(text: string, completed: boolean): void {
    this.target = text;
    this.completed = this.completed || completed;
    this.streaming = true;

    if (!this.timer) this.typeCharacter();
  }

  typeCharacter(): void {
    this.timer = null;

    const remaining = this.target.length - this.text.length;

    if (remaining <= 0) {
      // Alcançou o que chegou: termina se o resumo completo já veio; senão
      // espera o próximo pedaço com o "●" no fim.
      if (this.completed) this.streaming = false;
      m.redraw();
      return;
    }

    const step =
      this.completed && !this.generated ? Math.ceil(remaining / COMPLETION_CATCH_UP_STEPS) : Math.max(1, Math.ceil(remaining / MAX_TYPING_TICKS));

    this.text = this.target.slice(0, this.text.length + step);
    m.redraw();

    this.timer = setTimeout(() => this.typeCharacter(), TYPING_DELAY);
  }

  stopTyping(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  request(regenerate: boolean): void {
    const discussion = this.discussion;

    if (!discussion) return;

    if (regenerate) this.reset();

    this.loading = true;
    m.redraw();

    // Quem não pode gerar só lê o resumo pronto.
    if (!aiInfo()?.canSummarize) {
      // O recurso `canela-ai-summaries` responde 404 quando o tópico ainda não
      // tem resumo: aí o painel diz que não há, sem alerta de erro.
      app
        .request<{ data: { attributes: SummaryData } }>({
          method: 'GET',
          url: `${app.forum.attribute<string>('apiUrl')}/canela-ai-summaries/${discussion.id()}`,
          errorHandler: () => {},
        })
        .then((response) => {
          this.summary = response.data.attributes;
          // O texto do resumo pronto também aparece (antes só o resumo era
          // guardado, e o painel dizia que não havia resumo).
          if (this.summary.text) this.receive(this.summary.text, true);
        })
        .catch(() => {})
        .finally(() => {
          this.loading = false;
          m.redraw();
        });

      return;
    }

    this.controller = new AbortController();

    aiStream(
      `summaries/${discussion.id()}`,
      { regenerate },
      (line) => {
        if (this.discussion !== discussion) return;

        if (line.type === 'delta') {
          this.loading = false;
          this.generated = true;
          this.receive(this.target + String(line.text || ''), false);
        } else if (line.type === 'summary') {
          this.summary = line.summary;
          this.loading = false;
          this.receive(line.summary?.text ?? this.target, true);
          discussion.pushAttributes({ canelaAiHasSummary: true });
        } else if (line.type === 'error') {
          app.alerts.show({ type: 'error' }, line.message);
        }

        m.redraw();
      },
      this.controller.signal
    )
      .catch(showAiError)
      .finally(() => {
        this.loading = false;
        this.controller = null;
        // A conexão fechou: o que chegou termina de aparecer (rápido), em vez
        // de o "●" ficar no fim para sempre.
        if (this.target.length > this.text.length || this.streaming) this.receive(this.target, true);
        m.redraw();
      });
  }
}

export const summaryState = new SummaryState();

let mounted = false;

function mountPanel(): void {
  if (mounted) return;

  const root = document.createElement('div');
  root.className = 'CanelaAiSummaryRoot';
  document.body.appendChild(root);
  m.mount(root, SummaryPanel);
  mounted = true;
}

class SummaryPanel extends Component {
  view(): Mithril.Children {
    const state = summaryState;

    if (!state.open || !state.discussion) return null;

    const summary = state.summary;
    const showFooter = !!summary && !state.streaming;

    return (
      <div
        className={classList('ai-summary-modal CanelaAiSummary', { 'is-exiting': state.closing })}
        role="dialog"
        aria-label={t('ai.summary.title')}
      >
        <div className="CanelaAiSummary-container">
          <header className="CanelaAiSummary-header">
            <h2 className="CanelaAiSummary-title">{t('ai.summary.title')}</h2>
            <Button
              className="Button Button--icon Button--flat CanelaAiSummary-close"
              icon="fas fa-xmark"
              aria-label={t('ai.summary.close')}
              title={t('ai.summary.close')}
              onclick={() => state.hide()}
            />
          </header>
          <div className="CanelaAiSummary-body">
            <article className={classList('ai-summary-box streamable-content', { streaming: state.streaming })}>
              {state.loading ? (
                <div className="ai-summary__container">
                  {blinkingAnimation()}
                  <span>
                    <div className="ai-summary__generating-text">{t('ai.summary.in_progress')}</div>
                    {indicatorWave()}
                  </span>
                </div>
              ) : state.text ? (
                <Cooked className="generated-summary" text={state.text} streaming={state.streaming} />
              ) : (
                <p className="CanelaAiSummary-empty">{t('ai.summary.empty')}</p>
              )}
            </article>
          </div>
          {showFooter && summary && (
            <footer className="CanelaAiSummary-footer">
              <p className="summarized-on">
                {t('ai.summary.summarized_on', { date: summary.updatedAt ? fullDate(new Date(summary.updatedAt)) : '' })}{' '}
                <Tooltip text={t('ai.summary.model_used', { model: summary.model || '' })}>
                  <span className="CanelaAiSummary-info">
                    <Icon name="fas fa-circle-info" />
                  </span>
                </Tooltip>
              </p>
              {summary.outdated && (
                <p className="summary-outdated">
                  {t('ai.summary.outdated')}
                  {summary.newPostsSinceSummary > 0 ? ' ' + t('ai.summary.outdated_posts', { count: summary.newPostsSinceSummary }) : ''}
                </p>
              )}
              {summary.canRegenerate && (
                <Button className="Button CanelaAiSummary-regenerate" icon="fas fa-arrows-rotate" onclick={() => state.request(true)}>
                  {t('ai.summary.regenerate')}
                </Button>
              )}
            </footer>
          )}
        </div>
      </div>
    );
  }
}
