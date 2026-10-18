/*
 * Seletor de idioma do brechó: no cabeçalho, a pílula com a bandeira do
 * idioma atual e o código curto ("PT ⌄"); aberto, um balão com seta e, em
 * cada linha, a bandeira redonda, o nome e o código do idioma (o atual com um
 * anel na cor de destaque).
 *
 * As bandeiras (flag-icons, MIT, recorte 1×1) moram em assets/flags e são
 * publicadas pelo `php flarum assets:publish` em
 * /assets/extensions/ramon-canela/flags.
 */
import app from 'flarum/forum/app';
import Dropdown from 'flarum/common/components/Dropdown';
import type Mithril from 'mithril';

import { t } from '../utils/settings';

/** Códigos de país com bandeira em assets/flags (ao pôr ou tirar arquivos, regrave a lista). */
const FLAGS = new Set(
  'ad ae af ag ai al am ao aq ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cf cg ch ci ck cl cm cn co cp cr cu cv cw cx cy cz de dg dj dk dm do dz ec ee eg eh er es et eu fi fj fk fm fo fr ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu ic id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pc pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um un us uy uz va vc ve vg vi vn vu wf ws xk ye yt za zm zw'.split(
    ' '
  )
);

/** País padrão de um código só de idioma (com região vale a região: `pt-BR` → br). */
const COUNTRY: Record<string, string> = {
  en: 'us',
  pt: 'pt',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  nl: 'nl',
  ja: 'jp',
  zh: 'cn',
  ru: 'ru',
  tr: 'tr',
  pl: 'pl',
  uk: 'ua',
  ko: 'kr',
  ar: 'sa',
  vi: 'vn',
  id: 'id',
  sv: 'se',
  da: 'dk',
  nb: 'no',
  no: 'no',
  fi: 'fi',
  cs: 'cz',
  el: 'gr',
  he: 'il',
  hu: 'hu',
  ro: 'ro',
  bg: 'bg',
  th: 'th',
  hi: 'in',
  bn: 'bd',
  fa: 'ir',
  ms: 'my',
  sk: 'sk',
  sl: 'si',
  hr: 'hr',
  sr: 'rs',
  lt: 'lt',
  lv: 'lv',
  et: 'ee',
  ca: 'es',
  is: 'is',
  ga: 'ie',
  sq: 'al',
  mk: 'mk',
  ka: 'ge',
  hy: 'am',
  az: 'az',
  kk: 'kz',
  uz: 'uz',
  mn: 'mn',
  ne: 'np',
  si: 'lk',
  km: 'kh',
  lo: 'la',
  my: 'mm',
  sw: 'ke',
  af: 'za',
  am: 'et',
  ur: 'pk',
  tl: 'ph',
};

/** País da bandeira de um locale (`pt-BR` → br, `en` → us), ou `null` sem bandeira empacotada. */
function countryOf(locale: string): string | null {
  const [language, ...rest] = locale.toLowerCase().split(/[-_]/);
  const country = rest.find((part) => /^[a-z]{2}$/.test(part)) ?? COUNTRY[language];

  return country && FLAGS.has(country) ? country : null;
}

/** A bandeira com medidas fixas (nada pula ao carregar); sem bandeira, um selo com as duas letras. */
export function flag(locale: string, size: number): Mithril.Children {
  const country = countryOf(locale);

  return country ? (
    <img
      className="CanelaFlag"
      src={`${app.forum.attribute('assetsBaseUrl')}/extensions/ramon-canela/flags/${country}.svg`}
      width={size}
      height={size}
      alt=""
      decoding="sync"
    />
  ) : (
    <span className="CanelaFlag CanelaFlag--code" style={{ width: `${size}px`, height: `${size}px` }} aria-hidden="true">
      {locale.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** O código completo ao lado da bandeira: "pt-BR" → "PT-BR", "en" → "EN". */
function shortCode(locale: string): string {
  return locale.replace('_', '-').toUpperCase();
}

/** A mesma troca do core: logado grava a preferência; visitante grava o cookie; a página recarrega. */
function choose(locale: string): void {
  if (locale === (app.data as any).locale) return;

  if (app.session.user) {
    app.session.user.savePreferences({ locale }).then(() => window.location.reload());
  } else {
    document.cookie = `locale=${locale}; path=/; expires=Tue, 19 Jan 2038 03:14:07 GMT`;
    window.location.reload();
  }
}

/** As setas andam entre as bandeiras (dando a volta); Enter e espaço escolhem, como em todo botão. */
function move(event: KeyboardEvent): void {
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[event.key];

  if (!step) return;

  const menu = (event.currentTarget as HTMLElement).closest('.CanelaLocale-menu');
  const options = menu ? Array.from(menu.querySelectorAll<HTMLElement>('.CanelaLocale-option')) : [];

  event.preventDefault();
  event.stopPropagation();
  options[(options.indexOf(event.currentTarget as HTMLElement) + step + options.length) % options.length]?.focus();
}

export default function LocaleFlags(): Mithril.Children {
  const locales = ((app.data as any).locales || {}) as Record<string, string>;
  const current = ((app.data as any).locale || 'en') as string;

  return (
    <Dropdown
      className="CanelaLocale"
      buttonClassName="Button CanelaLocale-toggle"
      menuClassName="Dropdown-menu--right CanelaLocale-menu"
      caretIcon="fas fa-angle-down"
      label={[flag(current, 18), <span className="CanelaLocale-code">{shortCode(current)}</span>]}
      accessibleToggleLabel={t('header.language', { name: locales[current] ?? current })}
    >
      {Object.entries(locales).map(([locale, name]) => (
        <button
          type="button"
          className={`CanelaLocale-option${locale === current ? ' CanelaLocale-option--current' : ''}`}
          role="menuitemradio"
          aria-checked={String(locale === current)}
          lang={locale}
          onclick={() => choose(locale)}
          onkeydown={move}
        >
          {flag(locale, 24)}
          <span className="CanelaLocale-name">{name}</span>
          <span className="CanelaLocale-optionCode">{locale}</span>
        </button>
      ))}
    </Dropdown>
  );
}
