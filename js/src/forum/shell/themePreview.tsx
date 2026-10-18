/*
 * As miniaturas de "Esquema de cores" (Configurações) desenhadas com o layout
 * do tema — cabeçalho com a busca no meio, barra lateral com "Iniciar Discussão" e
 * categorias, e o cartão com as abas e a lista — em vez da página do Flarum
 * padrão que o core desenha.
 *
 * Cada miniatura tem o próprio `data-theme`, então os tokens `--cn-*` dentro
 * dela já saem claros, escuros ou de alto contraste conforme o modo.
 */
import { override } from 'flarum/common/extend';
import ThemeMode from 'flarum/common/components/ThemeMode';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

/** Cores das categorias de mentira: as do Discourse, só para dar vida à miniatura. */
const CATEGORY_COLORS = ['#0088cc', '#e45735', '#f1592a', '#3ab54a'];

function preview(): Mithril.Children {
  return (
    <div className="ThemeMode-preview CanelaThemePreview">
      <div className="CanelaThemePreview-header">
        <span className="CanelaThemePreview-burger" />
        <span className="CanelaThemePreview-logo" />
        <span className="CanelaThemePreview-search" />
        <span className="CanelaThemePreview-avatar" />
      </div>
      <div className="CanelaThemePreview-body">
        <div className="CanelaThemePreview-sidebar">
          <span className="CanelaThemePreview-newTopic" />
          {[0, 1, 2].map((i) => (
            <span className={classList('CanelaThemePreview-link', { 'CanelaThemePreview-link--active': i === 0 })} key={`link${i}`}>
              <i />
              <b />
            </span>
          ))}
          <span className="CanelaThemePreview-section" />
          {CATEGORY_COLORS.map((color, i) => (
            <span className="CanelaThemePreview-link" key={`cat${i}`}>
              <i style={{ background: color, borderRadius: '1px' }} />
              <b />
            </span>
          ))}
        </div>
        <div className="CanelaThemePreview-main">
          <div className="CanelaThemePreview-card">
            <div className="CanelaThemePreview-nav">
              <span className="CanelaThemePreview-tab CanelaThemePreview-tab--active" />
              <span className="CanelaThemePreview-tab" />
              <span className="CanelaThemePreview-tab" />
              <span className="CanelaThemePreview-button" />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div className="CanelaThemePreview-row" key={`row${i}`}>
                <span className="CanelaThemePreview-title" style={{ width: `${[70, 55, 62, 48][i]}%` }} />
                <span className="CanelaThemePreview-badge" style={{ background: CATEGORY_COLORS[i] }} />
                <span className="CanelaThemePreview-count" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function installThemePreview() {
  override(ThemeMode.prototype, 'view', function (this: ThemeMode, _original: unknown, vnode: Mithril.Vnode<any, any>) {
    const { mode, selected, className, alternate, label, ...attrs } = vnode.attrs;

    return (
      <label
        className={classList('ThemeMode', className, `ThemeMode--${mode}`, { 'ThemeMode--active': selected, 'ThemeMode--switch': alternate })}
        {...attrs}
      >
        <div
          className="ThemeMode-container"
          data-theme={mode === 'auto' ? 'light' : mode}
          data-colored-header={document.documentElement.getAttribute('data-colored-header')}
        >
          {preview()}
          {/* "Preferência do sistema": a versão escura recortada na diagonal por cima. */}
          {mode === 'auto' ? <ThemeMode mode="dark" alternate={true} selected={selected} {...attrs} /> : null}
        </div>
        {!alternate ? <div className="ThemeMode-legend">{label}</div> : null}
      </label>
    );
  });
}
