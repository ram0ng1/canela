/*
 * O topo da página inicial. Sem tag: o banner de boas-vindas (ou
 * nada). Com tag: o hero grande da categoria (ou o TagHero do flarum/tags).
 *
 * O override roda depois do do flarum/tags (dependência opcional, carregada
 * antes), então `original()` já é o TagHero quando há tag e o WelcomeHero do
 * core quando não há.
 */
import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import type Mithril from 'mithril';

import { forumBool } from '../utils/settings';
import { currentTag } from '../utils/tags';
import WelcomeBanner from './WelcomeBanner';
import CategoryHero from './CategoryHero';

export function welcomeBannerVisible(): boolean {
  if (!forumBool('canelaWelcomeBanner', true)) return false;

  return !(forumBool('canelaWelcomeBannerGuestsOnly', false) && app.session.user);
}

export default function installHero(): void {
  override(IndexPage.prototype, 'hero', function (original: () => Mithril.Children) {
    const tag = currentTag();

    if (tag) {
      return forumBool('canelaCategoryHero', true) ? <CategoryHero model={tag} /> : original();
    }

    // Página de tag cuja tag ainda está sendo carregada: nada por um instante,
    // em vez de piscar o banner de boas-vindas.
    if (app.search.state.params().tags) return null;

    // Na busca o banner atrapalharia: os resultados são o que importa.
    if (app.search.state.params().q) return null;

    return welcomeBannerVisible() ? <WelcomeBanner /> : null;
  });

  // "Seguindo" (flarum/subscriptions): o fof/follow-tags troca o hero por uma
  // faixa cinza própria, num override que roda depois deste. No beforeMount o
  // tema fica por último e a página ganha o mesmo topo das categorias.
  app.beforeMount(() => {
    override(IndexPage.prototype, 'hero', function (original: () => Mithril.Children) {
      if (app.current.get('routeName') !== 'following') return original();

      return (
        <header className="Hero CanelaCategoryHero CanelaFollowingHero">
          <div className="container">
            <h1 className="CanelaCategoryHero-title">{app.translator.trans('flarum-subscriptions.forum.index.following_link')}</h1>
          </div>
        </header>
      );
    });
  });
}
