/*
 * linkrobins/wiki no visual do Canela (o Discourse/Horizon).
 *
 * - Barra lateral: o "Wiki" sai do fim da seção da comunidade, onde a wiki o
 *   punha pela navegação do IndexSidebar, e entra no lugar escolhido na opção
 *   da própria wiki, com o ícone do livro aberto (Lucide) e ativo em todas as
 *   rotas dela, não só no índice.
 * - Telas (índice, artigo, novo/editar): os ajustes moram em ./pages, num
 *   chunk nosso que desce antes do primeiro chunk da wiki (beforeChunk). Assim
 *   os `override` por nome de módulo já estão na fila quando as telas chegam,
 *   e quem nunca abre a wiki não baixa nada disso.
 * - O visual: less/forum/thirdparty/Wiki.less, só com a extensão habilitada e
 *   a integração ligada (@config-canela-wiki, extend.php).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import LinkButton from 'flarum/common/components/LinkButton';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import CanelaSidebar from '../../components/CanelaSidebar';
import { beforeChunk, once } from '../../utils/chunkGate';
import { thirdParty } from '../settings';
import { WIKI_ROUTE_PREFIX, onWikiRoute, wikiIndexUrl, wikiNavPriority, wt } from './shared';

export default function installWiki(): void {
  extend(CanelaSidebar.prototype, 'communityItems', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.wiki()) return;

    // O link que a wiki põe no IndexSidebar chega aqui pela navegação das
    // extensões; o do tema fica no lugar dele.
    if (items.has('linkrobins-wiki')) items.remove('linkrobins-wiki');

    const priority = wikiNavPriority();

    if (priority === null) return;

    items.add(
      'canelaWiki',
      <LinkButton href={wikiIndexUrl()} icon="fas fa-book-open" active={onWikiRoute()}>
        {wt('nav', 'Wiki')}
      </LinkButton>,
      priority
    );
  });

  const loadPages = once(() =>
    import('./pages').then((mod) => {
      mod.default();
      return mod;
    })
  );

  beforeChunk((namespace, url) => namespace === 'linkrobins-wiki' || /linkrobins-wiki/.test(url), loadPages);

  // O runtime do webpack da wiki nem sempre passa pelo loadChunk do registro
  // (o build dela baixa os chunks sozinho): as rotas esperam o nosso chunk
  // junto com a tela, e os `override` valem desde o primeiro desenho.
  app.beforeMount(() => {
    const lazy = (name: string): (() => Promise<any>) | null => {
      const component = (app.routes as any)[name]?.component;

      // Só as rotas sob demanda (função que devolve o import()).
      return typeof component === 'function' && !component.prototype ? component : null;
    };

    const index = lazy('linkrobins-wiki.index');
    const show = lazy('linkrobins-wiki.show');

    Object.keys(app.routes)
      .filter((name) => name.startsWith(WIKI_ROUTE_PREFIX))
      .forEach((name) => {
        let component = lazy(name);

        if (!component) return;

        // Novo e editar não têm página própria no tema: desenham o índice
        // (ou o artigo) e abrem o composer do artigo por cima, como o "Novo
        // tópico". Com a integração desligada, ficam as telas da wiki.
        const composeRoute = name === 'linkrobins-wiki.compose' || name === 'linkrobins-wiki.edit';

        if (composeRoute && thirdParty.wiki()) {
          const editing = name === 'linkrobins-wiki.edit';
          const target = editing ? show : index;

          if (target) component = target;

          const screen = component;

          (app.routes as any)[name].component = () =>
            Promise.all([screen(), loadPages()]).then(([mod, pages]) => {
              const match = editing ? /\/wiki\/([^/]+)\/edit\/?$/.exec(window.location.pathname) : null;

              pages.requestComposer(match ? decodeURIComponent(match[1]) : null);

              return mod;
            });

          return;
        }

        const screen = component;

        (app.routes as any)[name].component = () => Promise.all([screen(), loadPages().catch(() => null)]).then(([mod]) => mod);
      });
  });
}
