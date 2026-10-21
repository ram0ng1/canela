/*
 * O banner de boas-vindas: título grande, a mensagem de boas-vindas
 * do admin e um campo de busca em pílula, sobre o fundo tingido da página.
 *
 * Herda do Hero do core para manter a classe `.Hero` — o IndexPage mede a
 * altura dela para devolver o leitor ao mesmo ponto da lista.
 */
import app from 'flarum/forum/app';
import Hero from 'flarum/forum/components/Hero';
import GlobalSearch from 'flarum/forum/components/GlobalSearch';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool } from '../utils/settings';

export default class WelcomeBanner extends Hero {
  className(): string {
    return 'CanelaWelcome';
  }

  bodyItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const title = app.forum.attribute<string>('welcomeTitle')?.trim() || app.forum.attribute<string>('title');
    const message = app.forum.attribute<string>('welcomeMessage')?.trim();

    items.add(
      'text',
      <div className="CanelaWelcome-text">
        <h1 className="CanelaWelcome-title">{title}</h1>
        {/* A mensagem vem do admin (Aparência) e aceita HTML, como no WelcomeHero do core. */}
        {message ? <div className="CanelaWelcome-message">{m.trust(message)}</div> : null}
      </div>,
      100
    );

    if (forumBool('canelaWelcomeBannerSearch', true)) {
      items.add(
        'search',
        <div className="CanelaWelcome-search">
          <GlobalSearch state={app.search.state} />
        </div>,
        50
      );
    }

    return items;
  }
}
