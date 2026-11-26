/*
 * O card "Identidade visual" (src/Brand): a prévia da identidade gerada pelo
 * nome, o nome usado, o "Gerar outra" (a variação), as animações e, por área,
 * a arte do tema, uma imagem enviada ou nada. Cada mudança grava na hora, e a
 * prévia acompanha sem recarregar. O envio segue o do fundo da página
 * (BackgroundPicker): POST /api/canela/brand/{área}, que vira WebP.
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';

import { BORDER_CHOICES, EFFECT_CHOICES, SHAPE_CHOICES, brandMark, brandScene, identity } from '../../common/brand/identity';
import { AdminComponent, getBool, getStr, saveSetting, trans } from '../util';
import AdminToggle from './AdminToggle';

const KEY = 'ramon-canela.admin.brand';

const AREAS = ['header', 'welcome', 'empty', 'auth', 'not_found'] as const;

type Area = (typeof AREAS)[number];

function save(key: string, value: string | number): void {
  app.data.settings[key] = String(value);
  m.redraw();
  saveSetting({ [key]: value });
}

class AreaPicker extends AdminComponent<{ area: Area }> {
  loading = false;
  error: string | null = null;

  view() {
    const area = this.attrs.area;
    const mode = getStr(`canela.brand_${area}`, 'theme');
    const image = getStr(`canela.brand_${area}_image`);
    const url = image ? `${String(app.forum.attribute('assetsBaseUrl') || '').replace(/\/$/, '')}/${image}` : null;

    return (
      <div className="Form-group CanelaBrandArea">
        <label className="CanelaAdmin-label">{trans(`${KEY}.area_${area}`)}</label>
        <div className="CanelaAdmin-select-wrap">
          <select
            className="FormControl CanelaAdmin-select"
            value={mode}
            onchange={(event: Event) => save(`canela.brand_${area}`, (event.target as HTMLSelectElement).value)}
          >
            {['theme', 'image', 'none'].map((key) => (
              <option key={key} value={key}>
                {trans(`${KEY}.mode_${key}${key === 'theme' && area === 'not_found' ? '_not_found' : ''}`)}
              </option>
            ))}
          </select>
          <i className="fas fa-chevron-down CanelaAdmin-select-chevron" aria-hidden="true" />
        </div>
        <p className="helpText">{trans(`${KEY}.area_${area}_help`)}</p>

        {mode === 'image' && (
          <div className="CanelaBackgroundPicker-image">
            {url ? <img className="CanelaBrandArea-preview" src={url} alt="" /> : <p className="helpText">{trans(`${KEY}.image_empty`)}</p>}
            <div className="CanelaBackgroundPicker-actions">
              <label className={`Button${this.loading ? ' disabled' : ''}`}>
                <i className="fas fa-upload Button-icon" aria-hidden="true" />
                <span className="Button-label">{trans(`ramon-canela.admin.backgrounds.${url ? 'replace' : 'upload'}`)}</span>
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
                  {trans('ramon-canela.admin.backgrounds.remove')}
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
    return `${app.forum.attribute('apiUrl')}/canela/brand/${this.attrs.area}`;
  }

  upload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    const body = new FormData();
    body.append('brand', file);

    this.loading = true;
    this.error = null;
    m.redraw();

    const attribute = `canelaBrand${this.attrs.area.replace(/(^|_)(\w)/g, (_, __, ch: string) => ch.toUpperCase())}Image`;

    app
      .request<any>({ method: 'POST', url: this.url(), serialize: (raw: FormData) => raw, body })
      .then((response) => {
        app.data.settings[`canela.brand_${this.attrs.area}_image`] = response?.data?.attributes?.[attribute] || '';
      })
      .catch(() => {
        this.error = trans('ramon-canela.admin.backgrounds.upload_error');
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
        app.data.settings[`canela.brand_${this.attrs.area}_image`] = '';
      })
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }
}

export default class BrandEditor extends AdminComponent {
  view() {
    const title = String(app.data.settings.forum_title || '');
    const name = getStr('canela.brand_name');
    const variant = Number(getStr('canela.brand_variant', '0')) || 0;
    const logo = getBool('canela.brand_use_logo') ? (app.forum.attribute<string>('logoUrl') ?? null) : null;
    const id = identity(name || title, variant, {
      shape: getStr('canela.brand_shape', 'auto'),
      effect: getStr('canela.brand_effect', 'auto'),
      border: getStr('canela.brand_border', 'fill'),
      logo,
    });
    // O modelo, a borda e o efeito: selects que gravam na hora, como os das áreas.
    const choice = (setting: string, list: readonly string[], auto: boolean) => (
      <div className="Form-group">
        <label className="CanelaAdmin-label">{trans(`${KEY}.${setting}_label`)}</label>
        <div className="CanelaAdmin-select-wrap">
          <select
            className="FormControl CanelaAdmin-select"
            value={getStr(`canela.brand_${setting}`, auto ? 'auto' : list[0])}
            onchange={(event: Event) => save(`canela.brand_${setting}`, (event.target as HTMLSelectElement).value)}
          >
            {(auto ? ['auto', ...list] : list).map((key) => (
              <option key={key} value={key}>
                {trans(`${KEY}.${setting}_${key}`)}
              </option>
            ))}
          </select>
          <i className="fas fa-chevron-down CanelaAdmin-select-chevron" aria-hidden="true" />
        </div>
      </div>
    );

    return (
      <>
        <div className="CanelaBrandPreview">
          <div className="CanelaBrandPreview-mark">{brandMark(id)}</div>
          <div className="CanelaBrandPreview-scene">{brandScene(id, 'welcome')}</div>
        </div>

        <div className="Form-group">
          <label className="CanelaAdmin-label">{trans(`${KEY}.name_label`)}</label>
          <input
            className="FormControl"
            value={name}
            placeholder={title}
            maxlength={60}
            onchange={(event: Event) => save('canela.brand_name', (event.target as HTMLInputElement).value.trim())}
          />
          <p className="helpText">{trans(`${KEY}.name_help`)}</p>
        </div>

        <div className="CanelaAdmin-actions">
          <Button className="Button" icon="fas fa-shuffle" onclick={() => save('canela.brand_variant', variant + 1)}>
            {trans(`${KEY}.shuffle`)}
          </Button>
          {variant !== 0 && (
            <Button className="Button" icon="fas fa-rotate-left" onclick={() => save('canela.brand_variant', 0)}>
              {trans(`${KEY}.original`)}
            </Button>
          )}
        </div>

        <div className="CanelaBrandChoices">
          {choice('shape', SHAPE_CHOICES, true)}
          {choice('border', BORDER_CHOICES, false)}
          {choice('effect', EFFECT_CHOICES, true)}
        </div>

        <AdminToggle
          settingKey="canela.brand_use_logo"
          label={trans(`${KEY}.use_logo_label`)}
          help={trans(`${KEY}.${app.forum.attribute('logoUrl') ? 'use_logo_help' : 'use_logo_missing'}`)}
        />

        <AdminToggle settingKey="canela.brand_motion" label={trans(`${KEY}.motion_label`)} help={trans(`${KEY}.motion_help`)} />

        {AREAS.map((area) => (
          <AreaPicker key={area} area={area} />
        ))}
      </>
    );
  }
}
