/*
 * A identidade visual nas áreas do fórum (src/Brand, js/src/common/brand):
 * o monograma ao lado do título no cabeçalho (só sem logo), a arte do banner
 * de boas-vindas, a da lista vazia e a do painel de entrar. Cada área segue o
 * admin: a arte gerada pelo nome, uma imagem enviada ou nada; com a chave
 * geral desligada, nenhuma aparece.
 */
import app from 'flarum/forum/app';
import type Mithril from 'mithril';

import { brandMark, brandScene, identity, type BrandArea, type Identity } from '../../common/brand/identity';
import { forumBool } from '../utils/settings';

let cached: { key: string; id: Identity } | null = null;

/** A identidade do fórum: o nome do admin (ou o título), a variação e o que o admin fixou. */
export function forumIdentity(): Identity {
  const attr = (name: string) => app.forum.attribute<string>(name) || '';
  const name = attr('canelaBrandName') || attr('title');
  const variant = Number(app.forum.attribute('canelaBrandVariant')) || 0;
  const choices = {
    shape: attr('canelaBrandShape'),
    effect: attr('canelaBrandEffect'),
    border: attr('canelaBrandBorder'),
    logo: forumBool('canelaBrandUseLogo', false) ? attr('logoUrl') || null : null,
  };
  const key = JSON.stringify([name, variant, choices]);

  if (cached?.key !== key) cached = { key, id: identity(name, variant, choices) };

  return cached.id;
}

const ATTR: Record<BrandArea, string> = {
  header: 'canelaBrandHeader',
  welcome: 'canelaBrandWelcome',
  empty: 'canelaBrandEmpty',
  auth: 'canelaBrandAuth',
};

/** A arte da área como o admin escolheu, ou `null`. */
export function brandArt(area: BrandArea): Mithril.Children {
  if (!app.forum || !forumBool('canelaBrandEnabled', true)) return null;

  const mode = app.forum.attribute<string>(ATTR[area]) || 'theme';

  if (mode === 'none') return null;

  if (mode === 'image') {
    const image = app.forum.attribute<string | null>(`${ATTR[area]}Image`);

    if (!image) return null;

    const base = String(app.forum.attribute('assetsBaseUrl') || '').replace(/\/$/, '');

    return <img className={`CanelaBrandImage CanelaBrandImage--${area}`} src={`${base}/${image}`} alt="" loading="lazy" decoding="async" />;
  }

  return area === 'header' ? brandMark(forumIdentity(), { className: 'CanelaBrand--header' }) : brandScene(forumIdentity(), area);
}

export default function installBrand(): void {
  app.beforeMount(() => {
    // "Sem animação" no admin vale como o prefers-reduced-motion, só para as artes.
    document.documentElement.classList.toggle('CanelaBrand-still', !forumBool('canelaBrandMotion', true));

    // O cabeçalho vem pronto do servidor: o monograma entra no link do título,
    // e só quando não há logo (o logo enviado já é a marca do fórum).
    const link = document.querySelector<HTMLElement>('#header .Header-title > #home-link');

    if (!link || link.querySelector('.Header-logo') || link.querySelector('.CanelaBrandSlot')) return;

    const mark = brandArt('header');

    if (!mark) return;

    const slot = document.createElement('span');
    slot.className = 'CanelaBrandSlot';
    link.prepend(slot);
    m.render(slot, mark);
  });
}
