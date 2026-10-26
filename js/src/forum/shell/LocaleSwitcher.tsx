/*
 * Seletor de idioma: no cabeçalho, a pílula com o código do idioma atual
 * ("PT-BR ⌄"); aberto, um balão com seta e, em cada linha, o nome e o código
 * do idioma (o atual em negrito, com um ✓).
 *
 * Sem bandeiras: bandeira é de país, não de idioma (o português não é só de
 * Portugal nem do Brasil), e confundia mais do que ajudava.
 */
import app from 'flarum/forum/app';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';

import { t } from '../utils/settings';

/** O código completo do idioma: "pt-BR" → "PT-BR", "en" → "EN". */
function shortCode(locale: string): string {
  return locale.replace('_', '-').toUpperCase();
}

/** A mesma troca do core: logado grava a preferência; visitante grava o cookie; a página recarrega. */
export function chooseLocale(locale: string): void {
  if (locale === app.data.locale) return;

  if (app.session.user) {
    app.session.user.savePreferences({ locale }).then(() => window.location.reload());
  } else {
    document.cookie = `locale=${locale}; path=/; expires=Tue, 19 Jan 2038 03:14:07 GMT`;
    window.location.reload();
  }
}

/** As setas andam entre os idiomas (dando a volta); Enter e espaço escolhem, como em todo botão. */
function move(event: KeyboardEvent): void {
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[event.key];

  if (!step) return;

  const menu = (event.currentTarget as HTMLElement).closest('.CanelaLocale-menu');
  const options = menu ? Array.from(menu.querySelectorAll<HTMLElement>('.CanelaLocale-option')) : [];

  event.preventDefault();
  event.stopPropagation();
  options[(options.indexOf(event.currentTarget as HTMLElement) + step + options.length) % options.length]?.focus();
}

export default function LocaleSwitcher(): Mithril.Children {
  const locales = (app.data.locales || {}) as Record<string, string>;
  const current = (app.data.locale || 'en') as string;

  return (
    <Dropdown
      className="CanelaLocale"
      buttonClassName="Button CanelaLocale-toggle"
      menuClassName="Dropdown-menu--right CanelaLocale-menu"
      caretIcon="fas fa-angle-down"
      label={<span className="CanelaLocale-code">{shortCode(current)}</span>}
      accessibleToggleLabel={t('header.language', { name: locales[current] ?? current })}
    >
      {Object.entries(locales).map(([locale, name]) => (
        <button
          type="button"
          className={`CanelaLocale-option${locale === current ? ' CanelaLocale-option--current' : ''}`}
          role="menuitemradio"
          aria-checked={String(locale === current)}
          lang={locale}
          onclick={() => chooseLocale(locale)}
          onkeydown={move}
        >
          <span className="CanelaLocale-name">{name}</span>
          <span className="CanelaLocale-optionCode">{locale}</span>
          {locale === current ? <Icon name="fas fa-check" className="CanelaLocale-check" /> : <span className="CanelaLocale-check" />}
        </button>
      ))}
    </Dropdown>
  );
}
