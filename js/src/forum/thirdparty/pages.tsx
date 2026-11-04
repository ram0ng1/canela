/*
 * fof/pages no jeito do Canela: a página (/p/{id}-…) sai sem o hero cinza
 * da extensão; o título vai para dentro do cartão, como o das Diretrizes.
 *
 * Uma página que é aba da área Sobre (Termos, Privacidade, as abas extras)
 * abre lá, com as abas, mesmo quem chega pelo /p/{id}: o mesmo conteúdo não
 * fica com dois visuais.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import type Mithril from 'mithril';

import { aboutPageUrl, findAboutPage, findLegalPage } from '../features/community/AboutNav';
import { forumBool } from '../utils/settings';

/** O endereço da página na área Sobre, quando ela é uma aba de lá. */
function aboutUrlFor(id: number): string | null {
  if (!id || !forumBool('canelaAboutEnabled', true)) return null;

  const tab = findAboutPage(id);

  if (tab) return aboutPageUrl(tab);

  const legal = findLegalPage(id);

  if (!legal) return null;

  return app.route('canela.about_page', { page: legal.slug ? `${id}-${legal.slug}` : String(id) });
}

export default function installPages(): void {
  const PagePage = 'ext:fof/pages/forum/components/PagePage';

  override(PagePage, 'hero', () => null);

  override(PagePage, 'content', function (this: any, original: () => Mithril.Children) {
    return [<h1 className="CanelaRules-title CanelaPages-title">{this.page?.title?.()}</h1>, original()];
  });

  extend(PagePage, 'show', function (this: any) {
    const url = aboutUrlFor(Number(this.page?.id?.()));

    if (url) m.route.set(url, null, { replace: true });
  });
}
