/*
 * Escolha do modelo da página 404 (card "Página 404"). Cada opção mostra um
 * esboço do layout, na cor de destaque do fórum; "Ver a página" abre um
 * endereço que não existe (/canela-404-preview) numa aba nova, com o modelo
 * gravado.
 *
 * Os modelos são os de views/gaps/not-found (GapsSettings::NOT_FOUND_TEMPLATES).
 */
import app from 'flarum/admin/app';
import type Mithril from 'mithril';

import { AdminComponent, getStr, saveSetting, trans } from '../util';

const KEY = 'ramon-canela.admin.settings.gaps';
const SETTING = 'canela.not_found_template';

const TEMPLATES: Record<string, { name: string; help: string }> = {
  classic: { name: 'Clássico', help: 'Lupa ao lado do título, faixa de busca e tópicos populares e recentes.' },
  minimal: { name: 'Minimalista', help: '"404" grande, o título, a busca numa linha e o botão. Sem tópicos.' },
  split: { name: 'Dividido', help: 'Texto, busca e tópicos recentes à esquerda; o mapa num painel à direita.' },
  signpost: { name: 'Placa', help: 'A placa de direção no centro, a faixa de busca e listas curtas de tópicos.' },
};

/** Esboços dos layouts: retângulos e linhas, sem texto. */
function sketch(template: string): Mithril.Children {
  const line = (x: number, y: number, w: number, h = 3, o = 0.35) => (
    <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="currentColor" opacity={o} />
  );
  const accent = (x: number, y: number, w: number, h: number, o = 1, rx = h / 2) => (
    <rect x={x} y={y} width={w} height={h} rx={rx} fill="var(--cn-np-accent)" opacity={o} />
  );
  const lists = (y: number, rows: number) =>
    [20, 66].map((x) => [line(x, y, 34, 3, 0.55), ...Array.from({ length: rows }, (_, i) => line(x, y + 8 + i * 6, 26 + (i % 2) * 6, 2, 0.3))]);

  const shapes: Record<string, Mithril.Children> = {
    classic: [
      <circle cx="30" cy="20" r="9" fill="none" stroke="var(--cn-np-accent)" stroke-width="2" opacity=".6" />,
      accent(36, 26, 8, 4, 0.8, 2),
      line(48, 14, 46, 4, 0.6),
      accent(56, 22, 28, 6),
      accent(4, 36, 112, 18, 0.15, 4),
      line(30, 41, 30, 3, 0.6),
      line(30, 47, 44, 3, 0.25),
      accent(78, 46, 12, 4),
      ...lists(60, 3),
    ],
    minimal: [
      <text x="60" y="34" text-anchor="middle" font-size="24" font-weight="800" fill="var(--cn-np-accent)">
        404
      </text>,
      line(32, 42, 56, 4, 0.6),
      line(38, 50, 44, 2, 0.3),
      line(30, 58, 46, 5, 0.25),
      accent(78, 58, 12, 5),
      accent(48, 68, 24, 6),
    ],
    split: [
      line(10, 14, 44, 5, 0.6),
      line(10, 22, 36, 5, 0.6),
      line(10, 31, 40, 2, 0.3),
      line(10, 38, 30, 5, 0.25),
      accent(42, 38, 12, 5),
      accent(10, 47, 22, 6),
      line(10, 59, 30, 3, 0.55),
      line(10, 66, 36, 2, 0.3),
      line(10, 72, 28, 2, 0.3),
      accent(64, 12, 48, 64, 0.15, 6),
      <path d="M72 28l10-3v32l-10 3zM82 25l12 3v32l-12-3zM94 28l10-3v32l-10 3z" fill="var(--cn-np-accent)" opacity=".45" />,
    ],
    signpost: [
      accent(58, 6, 4, 26, 0.8, 1),
      <path d="M62 10h16l3 3-3 3H62zM58 18H44l-3 3 3 3h14z" fill="var(--cn-np-accent)" opacity=".5" />,
      line(36, 36, 48, 4, 0.6),
      accent(48, 43, 24, 5),
      accent(14, 52, 92, 12, 0.15, 3),
      line(34, 56, 40, 3, 0.25),
      ...lists(68, 2),
    ],
  };

  return (
    <svg viewBox="0 0 120 84" aria-hidden="true">
      {shapes[template]}
    </svg>
  );
}

export default class NotFoundPicker extends AdminComponent {
  view() {
    const current = getStr(SETTING, 'classic');
    const accent = getStr('theme_primary_color', '#4d698e');
    const forum = app.forum.attribute<string>('baseUrl');

    return (
      <div className="CanelaNotFoundPicker" style={{ '--cn-np-accent': accent }}>
        <div className="Form-group">
          <label className="CanelaAdmin-label">{trans(`${KEY}.not_found_template_label`, 'Modelo')}</label>
          <div className="CanelaNotFoundPicker-grid" role="radiogroup">
            {Object.keys(TEMPLATES).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={current === key ? 'true' : 'false'}
                className={`CanelaNotFoundPicker-option${current === key ? ' is-selected' : ''}`}
                onclick={() => this.choose(key)}
              >
                <span className="CanelaNotFoundPicker-sketch">{sketch(key)}</span>
                <span className="CanelaNotFoundPicker-name">{trans(`${KEY}.not_found_template_${key}`, TEMPLATES[key].name)}</span>
              </button>
            ))}
          </div>
          <p className="helpText">
            {trans(`${KEY}.not_found_template_${current}_help`, TEMPLATES[current]?.help ?? '')}{' '}
            <a href={`${forum}/canela-404-preview`} target="_blank" rel="noopener">
              {trans(`${KEY}.not_found_template_view`, 'Ver a página')}
            </a>
          </p>
        </div>
      </div>
    );
  }

  choose(key: string) {
    app.data.settings[SETTING] = key;
    m.redraw();
    saveSetting({ [SETTING]: key });
  }
}
