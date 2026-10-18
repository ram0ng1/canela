/*
 * Prévia da paleta que o tema deriva da cor primária do Flarum.
 *
 * As amostras são pintadas pelo CSS do painel (less/admin/CanelaSettings.less)
 * com as mesmas fórmulas `oklch(from …)` de less/common/tokens.less — a prévia
 * é o próprio cálculo do fórum, não uma aproximação em JS. A cor entra por uma
 * variável no estilo, lida das configurações: assim a prévia acompanha a cor
 * gravada mesmo antes de o CSS do admin ser recompilado — e a amostra da cor
 * atual, dentro do mesmo bloco, nunca discorda das derivadas.
 */
import app from 'flarum/admin/app';
import { trans } from '../util';

const KEY = 'ramon-canela.admin.settings';

/** Só um hexadecimal entra no atributo `style`: o valor vem do banco. */
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const SCHEMES = ['light', 'dark'] as const;

const SWATCHES: { key: string; label: () => string }[] = [
  { key: 'accent', label: () => trans(`${KEY}.palette_accent`, 'Destaque') },
  { key: 'background', label: () => trans(`${KEY}.palette_background`, 'Fundo tingido') },
  { key: 'selected', label: () => trans(`${KEY}.palette_selected`, 'Seleção') },
  { key: 'accent-low', label: () => trans(`${KEY}.palette_accent_low`, 'Destaque suave') },
  { key: 'ring', label: () => trans(`${KEY}.palette_ring`, 'Anel de foco') },
  { key: 'link', label: () => trans(`${KEY}.palette_link`, 'Link') },
];

const primaryColor = (): string | null => {
  const value = String(app.data.settings.theme_primary_color ?? '').trim();

  return HEX_COLOR.test(value) ? value : null;
};

export const PalettePreview: any = {
  view() {
    const color = primaryColor();

    return (
      <div className="CanelaAdmin-palette" style={color ? `--cn-preview-accent: ${color}` : undefined}>
        <div className="CanelaAdmin-colorCurrent">
          <span className="CanelaAdmin-label">{trans(`${KEY}.colors_current`, 'Cor primária atual')}</span>
          <span className="CanelaAdmin-colorChip">
            <span className="CanelaAdmin-colorDot" aria-hidden="true" />
            <code>{color ?? '-'}</code>
          </span>
        </div>
        {SCHEMES.map((scheme) => (
          <div key={scheme} className={`CanelaAdmin-paletteRow CanelaAdmin-paletteRow--${scheme}`}>
            <span className="CanelaAdmin-paletteScheme">
              {scheme === 'light' ? trans(`${KEY}.palette_light`, 'Claro') : trans(`${KEY}.palette_dark`, 'Escuro')}
            </span>
            <div className="CanelaAdmin-swatches">
              {SWATCHES.map((swatch) => (
                <span key={swatch.key} className="CanelaAdmin-swatch" data-swatch={swatch.key}>
                  <span className="CanelaAdmin-swatchColor" aria-hidden="true" />
                  <span className="CanelaAdmin-swatchLabel">{swatch.label()}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  },
};
