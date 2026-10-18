/*
 * O rodapé da barra lateral como o do Discourse: o seletor de paleta em texto
 * ("Padrão ⌄", como o "Meta Branded ⌄" do Meta) e o botão do modo de cor — sol,
 * lua ou meio círculo — com o menu Claro / Escuro / Automático
 * (`interface-color-selector`).
 *
 * O Flarum guarda um esquema só (`light`, `dark`, `auto`, `light-hc`,
 * `dark-hc`); aqui ele vira dois eixos: o modo e a paleta (padrão ou alto
 * contraste). "Automático" com alto contraste não existe no core: a escolha
 * fica no navegador e o `data-theme` resolvido ganha o `-hc` (veja
 * `installColorMode`).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import Separator from 'flarum/common/components/Separator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';

type Mode = 'light' | 'dark' | 'auto';

const HC_KEY = 'canela.highContrast';

const MODE_ICONS: Record<Mode, string> = {
  light: 'fas fa-sun',
  dark: 'fas fa-moon',
  auto: 'fa-solid fa-circle-half-stroke',
};

function storedHighContrast(): boolean {
  try {
    return localStorage.getItem(HC_KEY) === '1';
  } catch {
    return false;
  }
}

function storeHighContrast(value: boolean): void {
  try {
    if (value) localStorage.setItem(HC_KEY, '1');
    else localStorage.removeItem(HC_KEY);
  } catch {
    // Sem armazenamento: vale até sair da página.
  }
}

function currentScheme(): string {
  return app.colorScheme ?? app.session.user?.preferences()?.colorScheme ?? app.forum.attribute<string>('colorScheme') ?? 'auto';
}

function currentMode(): Mode {
  const scheme = currentScheme();

  return scheme.startsWith('dark') ? 'dark' : scheme.startsWith('light') ? 'light' : 'auto';
}

function currentHighContrast(): boolean {
  const scheme = currentScheme();

  return scheme === 'auto' ? storedHighContrast() : scheme.endsWith('-hc');
}

/** Grava a combinação como o ThemeSwitcher do core grava o esquema. */
function apply(mode: Mode, highContrast: boolean): void {
  const scheme = mode === 'auto' ? 'auto' : highContrast ? `${mode}-hc` : mode;

  storeHighContrast(highContrast);
  app.setColorScheme(scheme);

  if (app.session.user) {
    app.session.user.savePreferences({ colorScheme: scheme });
  } else {
    try {
      sessionStorage.setItem('colorScheme', scheme);
    } catch {
      // O navegador bloqueia o armazenamento.
    }
  }

  m.redraw();
}

/**
 * "Automático" + alto contraste: o core resolve `auto` para `light`/`dark`
 * (só soma `-hc` quando o sistema pede contraste); aqui o `-hc` entra também
 * quando a pessoa escolheu a paleta de alto contraste.
 */
export function installColorMode(): void {
  extend(app as any, 'setColorScheme', function () {
    if (app.colorScheme !== 'auto' || !storedHighContrast()) return;

    const resolved = document.documentElement.getAttribute('data-theme') || 'light';

    if (!resolved.endsWith('-hc')) document.documentElement.setAttribute('data-theme', `${resolved}-hc`);
  });
}

/** Um tema oferecido pelo ernestdefoe/wardrobe (posto no payload da página). */
type WardrobeTheme = { id: string; title: string };

type WardrobeData = { themes: WardrobeTheme[]; active: string | null; allowUserChoice: boolean };

/** Mesmo cookie do Wardrobe: é ele que o servidor lê para o visitante sem conta. */
const WARDROBE_COOKIE = 'wardrobe_theme';

/**
 * Os temas que dá para escolher, ou `null` sem o Wardrobe (ou com um tema só,
 * ou com a escolha desligada no admin dele): aí o seletor volta a ser só o das
 * paletas.
 */
function wardrobe(): WardrobeData | null {
  const data = (app.data as any).wardrobe as WardrobeData | undefined;

  return data && data.allowUserChoice && data.themes.length > 1 ? data : null;
}

/**
 * Troca de tema como o Wardrobe troca: preferência de quem tem conta (vale em
 * todo aparelho), cookie de quem não tem. E recarrega: cada tema tem o próprio
 * JS e CSS, então a página aberta é literalmente o código do tema que fica.
 */
function chooseTheme(id: string): void {
  const user = app.session.user;

  if (!user) {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';

    document.cookie = `${WARDROBE_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    window.location.reload();

    return;
  }

  user
    .savePreferences({ wardrobeTheme: id })
    .then(() => window.location.reload())
    .catch(() => app.alerts.show({ type: 'error' }, t('sidebar.theme.save_failed')));
}

/**
 * O seletor em texto do rodapé, como o "🖌 Meta Branded ⌄" do Meta. Com o
 * Wardrobe e mais de um tema, mostra o pincel e o nome do tema, e o menu lista
 * os temas; as paletas (Padrão / Alto contraste) ficam numa seção separada do
 * mesmo menu. Sem o Wardrobe, é só o seletor de paletas, como antes.
 */
export class FooterPaletteSelector extends Component {
  view(): Mithril.Children {
    const highContrast = currentHighContrast();
    const palettes = [
      { id: false, label: t('sidebar.palette.default') },
      { id: true, label: t('sidebar.palette.high_contrast') },
    ];
    const current = palettes.find((palette) => palette.id === highContrast)!;
    const themes = wardrobe();
    const activeTheme = themes?.themes.find((theme) => theme.id === themes.active) ?? themes?.themes[0];

    const paletteOptions = palettes.map((palette) => (
      <Button
        className={classList('CanelaPaletteSelector-option', { active: palette.id === highContrast })}
        onclick={() => apply(currentMode(), palette.id)}
      >
        <span className={classList('CanelaPaletteSelector-dot', { 'CanelaPaletteSelector-dot--hc': palette.id })} aria-hidden="true" />
        {palette.label}
      </Button>
    ));

    if (!themes || !activeTheme) {
      return (
        <Dropdown
          className="CanelaPaletteSelector"
          buttonClassName="Button Button--flat CanelaPaletteSelector-toggle"
          menuClassName="CanelaPaletteSelector-menu"
          label={<span className="CanelaPaletteSelector-label">{current.label}</span>}
          caretIcon="fas fa-chevron-down"
          accessibleToggleLabel={t('sidebar.palette.title')}
        >
          {paletteOptions}
        </Dropdown>
      );
    }

    return (
      <Dropdown
        className="CanelaPaletteSelector CanelaPaletteSelector--themes"
        buttonClassName="Button Button--flat CanelaPaletteSelector-toggle"
        menuClassName="CanelaPaletteSelector-menu"
        label={
          <span className="CanelaPaletteSelector-label">
            <Icon name="fas fa-paintbrush" className="CanelaPaletteSelector-brush" />
            {activeTheme.title}
          </span>
        }
        caretIcon="fas fa-chevron-down"
        accessibleToggleLabel={t('sidebar.theme.title')}
      >
        <span className="CanelaPaletteSelector-heading">{t('sidebar.theme.title')}</span>
        {themes.themes.map((theme) => (
          <Button
            className={classList('CanelaPaletteSelector-option', { active: theme.id === activeTheme.id })}
            icon={theme.id === activeTheme.id ? 'fas fa-check' : 'fas fa-paintbrush'}
            onclick={() => theme.id !== activeTheme.id && chooseTheme(theme.id)}
          >
            {theme.title}
          </Button>
        ))}
        <Separator />
        <span className="CanelaPaletteSelector-heading">{t('sidebar.palette.title')}</span>
        {paletteOptions}
      </Dropdown>
    );
  }
}

/** O botão de modo de cor: só o ícone, com o menu de três opções. */
export class FooterColorMode extends Component {
  view(): Mithril.Children {
    const mode = currentMode();
    const modes: Mode[] = ['light', 'dark', 'auto'];

    return (
      <Dropdown
        className="CanelaColorMode"
        buttonClassName="Button Button--icon Button--flat CanelaColorMode-toggle"
        menuClassName="CanelaColorMode-menu"
        icon={MODE_ICONS[mode]}
        caretIcon=""
        label=""
        accessibleToggleLabel={t('sidebar.color_mode.title')}
      >
        {modes.map((option) => (
          <Button
            className={classList('CanelaColorMode-option', `CanelaColorMode-option--${option}`, { active: option === mode })}
            onclick={() => apply(option, currentHighContrast())}
          >
            <Icon name={MODE_ICONS[option]} className="Button-icon" />
            <span className="Button-label">{t(`sidebar.color_mode.${option}`)}</span>
          </Button>
        ))}
      </Dropdown>
    );
  }
}
