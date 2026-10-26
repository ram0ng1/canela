/*
 * O modal do envio: a área capturada, o tipo de pedido e a descrição.
 * Com "Mudar texto ou imagem", também o texto atual e o sugerido.
 */
import app from 'flarum/forum/app';
import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import type { ReportContext } from './context';

export type Kind = 'bug' | 'content' | 'design' | 'idea';

export const KINDS: Kind[] = ['bug', 'content', 'design', 'idea'];

export const KIND_ICONS: Record<Kind, string> = {
  bug: 'fas fa-bug',
  content: 'fas fa-pen-to-square',
  design: 'fas fa-palette',
  idea: 'far fa-lightbulb',
};

export const apiUrl = (path: string) => `${((app.forum.attribute<string>('apiUrl') as string) || '/api').replace(/\/+$/, '')}${path}`;

export interface ReportModalAttrs extends IFormModalAttrs {
  region: string;
  /** A tela inteira, que fica pronta em segundo plano. */
  full: Promise<string | null>;
  context: ReportContext;
  onAnother: () => void;
}

export default class ReportModal extends FormModal<ReportModalAttrs> {
  private kind: Kind = 'bug';
  private description = '';
  private currentText = '';
  private suggestedText = '';

  oninit(vnode: Mithril.Vnode<ReportModalAttrs, this>) {
    super.oninit(vnode);

    // O texto sob a área já vem como o "texto atual" de um pedido de conteúdo.
    this.currentText = this.attrs.context.elements[0]?.text || '';
  }

  className() {
    return 'CanelaBugModal Modal--medium';
  }

  title() {
    return t('bug_reports.modal_title');
  }

  content() {
    return (
      <div className="Modal-body">
        <div className="Form">
          <figure className="CanelaBugModal-preview">
            <img src={this.attrs.region} alt={t('bug_reports.preview_alt')} />
            <figcaption>
              <Button className="Button Button--link" icon="fas fa-crop-simple" onclick={() => this.another()} disabled={this.loading}>
                {t('bug_reports.another_area')}
              </Button>
            </figcaption>
          </figure>

          <fieldset className="Form-group CanelaBugModal-kinds">
            <legend>{t('bug_reports.kind_label')}</legend>
            <div className="CanelaBugModal-kindList" role="radiogroup">
              {KINDS.map((kind) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={this.kind === kind ? 'true' : 'false'}
                  className={classList('CanelaBugModal-kind', { active: this.kind === kind })}
                  onclick={() => (this.kind = kind)}
                >
                  <i className={`icon ${KIND_ICONS[kind]}`} aria-hidden="true" />
                  {t(`bug_reports.kind_${kind}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="Form-group">
            <label htmlFor="CanelaBugModal-description">{t('bug_reports.description_label')}</label>
            <textarea
              id="CanelaBugModal-description"
              className="FormControl"
              rows={4}
              maxlength={4000}
              placeholder={t(`bug_reports.hint_${this.kind}`)}
              value={this.description}
              oninput={(e: InputEvent) => (this.description = (e.target as HTMLTextAreaElement).value)}
            />
          </div>

          {this.kind === 'content' && (
            <div className="CanelaBugModal-texts">
              <div className="Form-group">
                <label>{t('bug_reports.current_text')}</label>
                <textarea
                  className="FormControl"
                  rows={2}
                  maxlength={2000}
                  value={this.currentText}
                  oninput={(e: InputEvent) => (this.currentText = (e.target as HTMLTextAreaElement).value)}
                />
              </div>
              <div className="Form-group">
                <label>{t('bug_reports.suggested_text')}</label>
                <textarea
                  className="FormControl"
                  rows={2}
                  maxlength={2000}
                  value={this.suggestedText}
                  oninput={(e: InputEvent) => (this.suggestedText = (e.target as HTMLTextAreaElement).value)}
                />
              </div>
            </div>
          )}

          <p className="helpText">{t('bug_reports.context_help')}</p>

          <div className="Form-group">
            <Button type="submit" className="Button Button--primary" loading={this.loading} disabled={!this.description.trim()}>
              {t('bug_reports.send')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  another() {
    const again = this.attrs.onAnother;

    this.hide();
    setTimeout(again, 150);
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();

    if (!this.description.trim()) return;

    this.loading = true;

    this.attrs.full.then((full) =>
      app
        .request({
          method: 'POST',
          url: apiUrl('/canela-bug-reports'),
          body: {
            kind: this.kind,
            description: this.description,
            currentText: this.kind === 'content' ? this.currentText : '',
            suggestedText: this.kind === 'content' ? this.suggestedText : '',
            region: this.attrs.region,
            full,
            context: this.attrs.context,
          },
          errorHandler: (error: any) => {
            this.loading = false;
            this.alertAttrs = { type: 'error', content: error?.response?.errors?.[0]?.detail || t('bug_reports.send_failed') } as any;
            m.redraw();
          },
        })
        .then(() => {
          this.hide();
          app.alerts.show({ type: 'success' }, t('bug_reports.sent'));
        })
        .catch(() => {})
    );
  }
}
