/*
 * O fundo da página (src/Backgrounds): o select do estilo e, com "Imagem",
 * o envio da imagem com a prévia. Com `value` e `onchange`, o select vira
 * rascunho (quem usa decide quando gravar); a imagem é gravada ao enviar. O envio vai para
 * POST /api/canela/backgrounds/{forum|auth} (o mesmo caminho do logo do core:
 * vira WebP no disco de assets) e a prévia troca sem recarregar o admin.
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';

import { AdminComponent, getStr, saveSetting, trans } from '../util';

const KEY = 'ramon-canela.admin.backgrounds';

type Target = 'forum' | 'auth';

const STYLES = ['tinted', 'gradient', 'solid', 'plain', 'image'];

/** O fundo gravado (ou o padrão de quem ainda não escolheu). */
export function savedBackground(target: Target): string {
  const stored = getStr(`canela.${target}_background`);

  if (STYLES.includes(stored) || (target === 'auth' && stored === 'same')) return stored;

  // Sem escolha ainda: o fórum segue a chave antiga (fundo tingido ligado
  // ou desligado), e as páginas de entrar/cadastrar usam o do fórum.
  if (target === 'auth') return 'same';

  const legacy = String(app.data.settings['canela.tinted_background'] ?? '');

  return legacy === '0' || legacy === 'false' ? 'plain' : 'tinted';
}

export default class BackgroundPicker extends AdminComponent {
  loading = false;
  error: string | null = null;

  target(): Target {
    return this.attrs.target === 'auth' ? 'auth' : 'forum';
  }

  settingKey(): string {
    return `canela.${this.target()}_background`;
  }

  imageKey(): string {
    return `canela.${this.target()}_background_image`;
  }

  options(): Record<string, string> {
    const options: Record<string, string> = {};

    if (this.target() === 'auth') options.same = trans(`${KEY}.same`);

    options.tinted = trans(`${KEY}.tinted`);
    options.gradient = trans(`${KEY}.gradient`);
    options.solid = trans(`${KEY}.solid`);
    options.plain = trans(`${KEY}.plain`);
    options.image = trans(`${KEY}.image`);

    return options;
  }

  value(): string {
    // Rascunho: quem usa o componente guarda o valor e decide quando aplicar.
    if (this.attrs.value !== undefined) return String(this.attrs.value);

    return savedBackground(this.target());
  }

  view() {
    const { label, help } = this.attrs;
    const value = this.value();
    const options = this.options();
    const image = getStr(this.imageKey());
    const url = image ? `${String(app.forum.attribute('assetsBaseUrl') || '').replace(/\/$/, '')}/${image}` : null;

    return (
      <div className="Form-group CanelaBackgroundPicker">
        <label className="CanelaAdmin-label">{label}</label>
        <div className="CanelaAdmin-select-wrap">
          <select
            className="FormControl CanelaAdmin-select"
            value={value}
            onchange={(event: Event) => {
              const next = (event.target as HTMLSelectElement).value;

              if (this.attrs.onchange) {
                this.attrs.onchange(next);
                return;
              }

              app.data.settings[this.settingKey()] = next;
              m.redraw();
              saveSetting({ [this.settingKey()]: next });
            }}
          >
            {Object.keys(options).map((key) => (
              <option key={key} value={key}>
                {options[key]}
              </option>
            ))}
          </select>
          <i className="fas fa-chevron-down CanelaAdmin-select-chevron" aria-hidden="true" />
        </div>
        {help && <p className="helpText">{help}</p>}

        {value === 'image' && (
          <div className="CanelaBackgroundPicker-image">
            {url ? (
              <div className="CanelaBackgroundPicker-preview" style={{ backgroundImage: `url(${JSON.stringify(url)})` }} />
            ) : (
              <p className="helpText">{trans(`${KEY}.empty`)}</p>
            )}
            <div className="CanelaBackgroundPicker-actions">
              <label className={`Button${this.loading ? ' disabled' : ''}`}>
                <i className="fas fa-upload Button-icon" aria-hidden="true" />
                <span className="Button-label">{url ? trans(`${KEY}.replace`) : trans(`${KEY}.upload`)}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  disabled={this.loading}
                  onchange={(event: Event) => this.upload(event.target as HTMLInputElement)}
                />
              </label>
              {url && (
                <Button className="Button Button--danger" disabled={this.loading} onclick={() => this.remove()}>
                  {trans(`${KEY}.remove`)}
                </Button>
              )}
            </div>
            <p className="helpText">{trans(`${KEY}.image_help`)}</p>
            {this.error && <p className="CanelaBackgroundPicker-error">{this.error}</p>}
          </div>
        )}
      </div>
    );
  }

  url(): string {
    return `${app.forum.attribute('apiUrl')}/canela/backgrounds/${this.target()}`;
  }

  upload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    const body = new FormData();
    body.append('background', file);

    this.loading = true;
    this.error = null;
    m.redraw();

    app
      .request<any>({ method: 'POST', url: this.url(), serialize: (raw: FormData) => raw, body })
      .then((response) => {
        const attrs = response?.data?.attributes || {};
        const key = this.target() === 'auth' ? 'canelaAuthBackgroundImage' : 'canelaForumBackgroundImage';

        app.data.settings[this.imageKey()] = attrs[key] || '';
      })
      .catch(() => {
        this.error = trans(`${KEY}.upload_error`);
      })
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  remove(): void {
    this.loading = true;
    m.redraw();

    app
      .request({ method: 'DELETE', url: this.url() })
      .then(() => {
        app.data.settings[this.imageKey()] = '';
      })
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }
}
