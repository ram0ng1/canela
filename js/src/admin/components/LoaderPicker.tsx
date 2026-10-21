/*
 * Escolha do indicador de carregamento (card "Indicador de carregamento").
 *
 * Os desenhos prontos vêm do payload do admin (src/Theme/Loader/
 * LoaderAdminPayload.php), a mesma fonte que vai para a folha do fórum: a
 * prévia não tem cópia própria dos SVGs. A prévia pinta com máscara, como o
 * fórum (less/forum/Loader.less), então mostra a cor e o tamanho de verdade.
 *
 * Cada gravação destas chaves recompila o CSS do fórum (são variáveis do
 * LESS): nada aqui grava por tecla. O SVG próprio só vai ao clicar em
 * "Aplicar" ou ao enviar um arquivo; a cor, no `change` do seletor.
 */
import app from 'flarum/admin/app';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';

import { AdminComponent, getBool, getStr, saveSetting, trans } from '../util';
import AdminToggle from './AdminToggle';
import AdminNumber from './AdminNumber';
import { AdminNotice } from './AdminCard';

const KEY = 'ramon-canela.admin.settings.loader';

/** O mesmo teto do servidor (LoaderLess::MAX_BYTES). */
const MAX_BYTES = 65536;

const SIZE = { min: 50, max: 250, fallback: 100 };

/** Só um hexadecimal entra no `style`: o valor vem do banco. */
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const presets = (): Record<string, string> => (app.data as any).canelaLoaderPresets || {};

/** Como imagem o SVG não executa nada: a prévia do que se colou não precisa esperar o servidor. */
const svgUrl = (svg: string): string => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

const label = (style: string): string => {
  const fallbacks: Record<string, string> = {
    default: 'Padrão do Flarum',
    avocado: 'Avocado',
    orbital: 'Órbita',
    ring: 'Anel',
    dots: 'Pontos',
    bars: 'Barras',
    pulse: 'Pulso',
    custom: 'SVG próprio',
  };

  return trans(`${KEY}.style_${style}`, fallbacks[style] ?? style);
};

export default class LoaderPicker extends AdminComponent {
  /** O SVG que está no campo (ainda não aplicado), ou `null` = o gravado. */
  draft: string | null = null;
  error: string | null = null;

  view() {
    const style = getStr('canela.loader_style', 'default');
    const custom = this.draft ?? getStr('canela.loader_custom');
    const styles = ['default', ...Object.keys(presets()), 'custom'];
    const color = getStr('canela.loader_color');

    return (
      <div className="CanelaLoaderPicker">
        <div className="Form-group">
          <label className="CanelaAdmin-label">{trans(`${KEY}.style_label`, 'Desenho')}</label>
          <div className="CanelaLoaderPicker-grid" role="radiogroup">
            {styles.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={style === key ? 'true' : 'false'}
                className={`CanelaLoaderPicker-option${style === key ? ' is-selected' : ''}`}
                onclick={() => this.choose(key)}
              >
                <span className="CanelaLoaderPicker-stage" style={this.stageStyle(color)}>
                  {this.sample(key, custom)}
                </span>
                <span className="CanelaLoaderPicker-name">{label(key)}</span>
              </button>
            ))}
          </div>
        </div>

        {style === 'custom' && this.customFields(custom)}

        {style !== 'default' && (
          <>
            {this.colorField(color)}
            <AdminNumber
              settingKey="canela.loader_size"
              min={SIZE.min}
              max={SIZE.max}
              fallback={SIZE.fallback}
              suffix="%"
              label={trans(`${KEY}.size_label`, 'Tamanho')}
              help={trans(`${KEY}.size_help`, 'Em relação ao spinner do Flarum, de {min}% a {max}%. Nos botões o indicador acompanha o texto.', {
                min: SIZE.min,
                max: SIZE.max,
              })}
            />
            {this.preview(style, custom, color)}
          </>
        )}

        <AdminNotice>{trans(`${KEY}.notice`, 'Trocar o indicador recompila o CSS do fórum; a gravação leva alguns segundos.')}</AdminNotice>
      </div>
    );
  }

  stageStyle(color: string): Record<string, string> {
    return HEX_COLOR.test(color) ? { color } : {};
  }

  /** O desenho de um estilo, do tamanho pedido. */
  sample(key: string, custom: string, size = 32): any {
    if (key === 'default') {
      return <LoadingIndicator display="inline" size="large" />;
    }

    const svg = key === 'custom' ? custom.trim() : presets()[key];

    if (!svg) {
      return <i className="fas fa-file-arrow-up CanelaLoaderPicker-empty" aria-hidden="true" />;
    }

    const tint = key !== 'custom' || getBool('canela.loader_tint');

    return (
      <span
        className={`CanelaLoaderPicker-svg${tint ? '' : ' CanelaLoaderPicker-svg--image'}`}
        style={{ '--cn-lp-image': svgUrl(svg), '--cn-lp-size': `${size}px` }}
        aria-hidden="true"
      />
    );
  }

  customFields(custom: string) {
    const changed = this.draft !== null && this.draft !== getStr('canela.loader_custom');

    return (
      <div className="CanelaAdmin-subGroup">
        <div className="Form-group CanelaAdmin-textarea">
          <label className="CanelaAdmin-label" for="CanelaLoaderPicker-code">
            {trans(`${KEY}.custom_label`, 'Código do SVG')}
          </label>
          <textarea
            id="CanelaLoaderPicker-code"
            className="FormControl CanelaLoaderPicker-code"
            rows={6}
            spellcheck={false}
            placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">…</svg>'
            value={custom}
            oninput={(event: InputEvent) => {
              this.draft = (event.target as HTMLTextAreaElement).value;
              this.error = null;
            }}
          />
          <p className="helpText">
            {trans(
              `${KEY}.custom_help`,
              'Cole o código de um SVG animado ou envie um arquivo .svg (até 64 KB). Ele é limpo no servidor antes de ser salvo: saem scripts, eventos e links externos; as animações de CSS e SMIL continuam.'
            )}
          </p>
          {this.error && <p className="CanelaLoaderPicker-error">{this.error}</p>}
          {!custom.trim() && <p className="helpText">{trans(`${KEY}.custom_empty`, 'Cole ou envie um SVG para usar este desenho.')}</p>}
          <div className="CanelaAdmin-actions">
            <button type="button" className="Button Button--primary" disabled={!changed} onclick={() => this.applyCustom(this.draft ?? '')}>
              {trans(`${KEY}.custom_apply`, 'Aplicar SVG')}
            </button>
            <label className="Button CanelaLoaderPicker-upload">
              <i className="fas fa-upload Button-icon" aria-hidden="true" />
              <span className="Button-label">{trans(`${KEY}.custom_upload`, 'Enviar arquivo SVG')}</span>
              <input type="file" accept=".svg,image/svg+xml" onchange={(event: Event) => this.upload(event.target as HTMLInputElement)} />
            </label>
            {custom.trim() !== '' && (
              <button type="button" className="Button" onclick={() => this.applyCustom('')}>
                {trans(`${KEY}.custom_clear`, 'Remover')}
              </button>
            )}
          </div>
        </div>
        <AdminToggle
          settingKey="canela.loader_tint"
          label={trans(`${KEY}.tint_label`, 'Pintar com a cor do indicador')}
          help={trans(
            `${KEY}.tint_help`,
            'O SVG vira só a forma, pintado com a cor abaixo (ou com a cor do texto, nos botões). Desligado, ficam as cores do próprio arquivo.'
          )}
        />
      </div>
    );
  }

  colorField(color: string) {
    const valid = HEX_COLOR.test(color);
    const primary = String(app.data.settings.theme_primary_color || '#4d698e');

    return (
      <div className="Form-group">
        <label className="CanelaAdmin-label" for="CanelaLoaderPicker-color">
          {trans(`${KEY}.color_label`, 'Cor')}
        </label>
        <div className="CanelaLoaderPicker-colorRow">
          <input
            id="CanelaLoaderPicker-color"
            type="color"
            className="CanelaLoaderPicker-color"
            value={valid && color.length === 7 ? color : HEX_COLOR.test(primary) && primary.length === 7 ? primary : '#4d698e'}
            onchange={(event: Event) => this.save('canela.loader_color', (event.target as HTMLInputElement).value)}
          />
          <button type="button" className="Button" disabled={!valid} onclick={() => this.save('canela.loader_color', '')}>
            {trans(`${KEY}.color_primary`, 'Usar a cor do tema')}
          </button>
        </div>
        <p className="helpText">
          {trans(
            `${KEY}.color_help`,
            'Sem cor escolhida, vale a cor de destaque do tema (a primária, ou a da tag nas páginas de tag). Nos botões o indicador segue a cor do texto do botão.'
          )}
        </p>
      </div>
    );
  }

  /** Grande, médio e dentro de um botão, no tamanho escolhido. */
  preview(style: string, custom: string, color: string) {
    const scale = Math.min(SIZE.max, Math.max(SIZE.min, Number.parseInt(getStr('canela.loader_size', '100'), 10) || 100)) / 100;

    return (
      <div className="Form-group">
        <label className="CanelaAdmin-label">{trans(`${KEY}.preview`, 'Prévia')}</label>
        <div className="CanelaLoaderPicker-preview" style={this.stageStyle(color)}>
          {this.sample(style, custom, Math.round(30 * scale))}
          {this.sample(style, custom, Math.round(18 * scale))}
          <span className="Button Button--primary CanelaLoaderPicker-button">
            <span className="Button-label">{trans('core.admin.basics.submit_button', 'Salvar')}</span>
            <span className="CanelaLoaderPicker-buttonIcon">{this.sample(style, custom, 14)}</span>
          </span>
        </div>
      </div>
    );
  }

  choose(style: string): void {
    if (getStr('canela.loader_style', 'default') === style) return;

    this.save('canela.loader_style', style);
  }

  save(key: string, value: string) {
    const previous = app.data.settings[key];
    app.data.settings[key] = value;
    m.redraw();

    return saveSetting({ [key]: value }).catch((error: unknown) => {
      app.data.settings[key] = previous;
      m.redraw();

      throw error;
    });
  }

  applyCustom(svg: string): void {
    this.error = null;

    if (svg.trim() !== '' && !/<svg[\s>]/i.test(svg)) {
      this.error = trans(`${KEY}.custom_not_svg`, 'O arquivo não parece um SVG.');
      return;
    }

    if (new Blob([svg]).size > MAX_BYTES) {
      this.error = trans(`${KEY}.custom_too_big`, 'O arquivo passa de 64 KB.');
      return;
    }

    this.save('canela.loader_custom', svg.trim()).then(
      () => {
        this.draft = null;
        m.redraw();
      },
      () => {
        // O alerta do core já mostra o motivo (SVG inválido); o texto fica no campo para corrigir.
        this.draft = svg;
        m.redraw();
      }
    );
  }

  upload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    if (file.size > MAX_BYTES) {
      this.error = trans(`${KEY}.custom_too_big`, 'O arquivo passa de 64 KB.');
      m.redraw();
      return;
    }

    file.text().then((text) => {
      this.draft = text;
      this.applyCustom(text);
      m.redraw();
    });
  }
}
