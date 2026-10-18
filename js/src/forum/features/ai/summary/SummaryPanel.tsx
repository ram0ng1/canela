/*
 * O painel "Resumo da discussão" do Discourse (o ai-summary-modal): flutua à
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
import { aiInfo, aiRequest, aiStream, showAiError } from '../state';
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

class SummaryState {
  discussion: Discussion | null = null;
  open = false;
  closing = false;
  loading = false;
  streaming = false;
  text = '';
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
    this.text = '';
    this.summary = null;
    this.loading = false;
    this.streaming = false;
  }

  request(regenerate: boolean): void {
    const discussion = this.discussion;

    if (!discussion) return;

    if (regenerate) this.reset();

    this.loading = true;
    m.redraw();

    // Quem não pode gerar só lê o resumo pronto.
    if (!aiInfo()?.canSummarize) {
      aiRequest<{ data: SummaryData | null }>('GET', `summaries/${discussion.id()}`)
        .then((response) => (this.summary = response.data))
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
          this.streaming = true;
          this.text += String(line.text || '');
        } else if (line.type === 'summary') {
          this.summary = line.summary;
          this.text = line.summary?.text ?? this.text;
          this.streaming = false;
          this.loading = false;
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
        this.streaming = false;
        this.controller = null;
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
