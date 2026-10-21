/*
 * "Edições sugeridas" — o modal de diff do ajudante de IA.
 *
 * - Revisar texto: o diff palavra a palavra no próprio texto (o que sai
 *   riscado em vermelho, o que entra em verde), refeito a cada pedaço que
 *   chega — dá para ver a revisão acontecendo.
 * - Os outros modos: o texto novo em streaming; no fim, o antigo (borda
 *   vermelha) e o novo (borda verde), um sobre o outro.
 * - Explicar: só a explicação, com "Copiar" — não substitui nada.
 *
 * "Confirmar" troca o trecho selecionado (ou o texto todo) pelo novo,
 * "Descartar" fecha, "Tentar novamente" pede de novo.
 */
import app from 'flarum/forum/app';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import { diffWords } from '../../extras/history/diff';
import { aiStream, showAiError } from '../state';
import Cooked from '../Cooked';
import { indicatorWave } from '../ui';

export interface DiffModalAttrs extends IInternalModalAttrs {
  mode: string;
  text: string;
  language?: string;
  customPrompt?: string;
  context?: string;
  /** Troca o texto original pelo novo no editor. */
  apply: (text: string) => void;
}

export default class DiffModal extends Modal<DiffModalAttrs> {
  suggestion = '';
  final: string | null = null;
  waiting = true;
  streaming = false;
  controller: AbortController | null = null;

  oninit(vnode: Mithril.Vnode<DiffModalAttrs, this>) {
    super.oninit(vnode);
    this.request();
  }

  onremove(vnode: Mithril.VnodeDOM<DiffModalAttrs, this>) {
    super.onremove(vnode);
    this.controller?.abort();
  }

  className() {
    return 'composer-ai-helper-modal CanelaAiDiffModal Modal--large';
  }

  title() {
    return this.attrs.mode === 'explain' ? t('ai.helper.explain_title') : t('ai.helper.changes');
  }

  content() {
    const { mode, text } = this.attrs;
    const current = this.final ?? this.suggestion;
    const asDiff = mode === 'proofread';

    let body: Mithril.Children;

    if (this.waiting) {
      body = (
        <div className={classList('composer-ai-helper-modal__suggestion composer-ai-helper-modal__loading', { 'inline-diff': asDiff })}>{text}</div>
      );
    } else if (asDiff) {
      body = (
        <div className={classList('composer-ai-helper-modal__suggestion streamable-content inline-diff', { streaming: this.streaming })}>
          <span className="diff-inner">
            {diffWords(text, current).map((part) =>
              part.kind === 'insert' ? (
                <ins>{part.text}</ins>
              ) : part.kind === 'delete' ? (
                <del>{part.text}</del>
              ) : (
                <span className="same-word">{part.text}</span>
              )
            )}
          </span>
        </div>
      );
    } else if (this.streaming || mode === 'explain') {
      body = (
        <div className={classList('composer-ai-helper-modal__suggestion streamable-content', { streaming: this.streaming })}>
          <Cooked text={current} streaming={this.streaming} />
        </div>
      );
    } else {
      body = (
        <div className="composer-ai-helper-modal__suggestion">
          <div className="composer-ai-helper-modal__old-value">{text}</div>
          <div className="composer-ai-helper-modal__new-value">
            <Cooked text={current} />
          </div>
        </div>
      );
    }

    return [
      <div className="Modal-body">{<div className="text-preview">{body}</div>}</div>,
      <div className="Modal-footer CanelaAiDiffModal-footer">{this.footer()}</div>,
    ];
  }

  footer(): Mithril.Children {
    const busy = this.waiting || this.streaming;
    const explain = this.attrs.mode === 'explain';

    return [
      <Button
        className="Button Button--primary confirm"
        disabled={busy || !(this.final ?? this.suggestion).trim()}
        oncreate={(vnode: Mithril.VnodeDOM) => (vnode.dom as HTMLElement).focus()}
        onclick={() => (explain ? this.copy() : this.confirm())}
      >
        {busy ? (
          <span>
            {t('ai.helper.loading')}
            {indicatorWave()}
          </span>
        ) : explain ? (
          t('ai.helper.copy')
        ) : (
          t('ai.helper.confirm')
        )}
      </Button>,
      <Button className="Button Button--text discard" onclick={() => this.hide()}>
        {t('ai.helper.discard')}
      </Button>,
      <Button className="Button regenerate" icon="fas fa-arrows-rotate" disabled={busy} onclick={() => this.request()}>
        {t('ai.helper.regen')}
      </Button>,
    ];
  }

  request(): void {
    this.controller?.abort();
    this.controller = new AbortController();
    this.suggestion = '';
    this.final = null;
    this.waiting = true;
    this.streaming = false;

    const { mode, text, language, customPrompt, context } = this.attrs;

    aiStream(
      'helper',
      { mode, text, language, customPrompt, context },
      (line) => {
        if (line.type === 'delta') {
          this.waiting = false;
          this.streaming = true;
          this.suggestion += String(line.text || '');
        } else if (line.type === 'result') {
          this.final = String(line.text || '');
        } else if (line.type === 'error') {
          app.alerts.show({ type: 'error' }, line.message);
        }

        m.redraw();
      },
      this.controller.signal
    )
      .catch((error) => {
        showAiError(error);
        this.hide();
      })
      .finally(() => {
        this.waiting = false;
        this.streaming = false;
        m.redraw();
      });
  }

  confirm(): void {
    const result = (this.final ?? this.suggestion).trim();

    if (result) this.attrs.apply(result);

    this.hide();
  }

  copy(): void {
    navigator.clipboard?.writeText((this.final ?? this.suggestion).trim()).then(() => app.alerts.show({ type: 'success' }, t('ai.helper.copied')));
  }
}
