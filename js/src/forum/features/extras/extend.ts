/*
 * Extenders do fórum para os recursos "extras": a rota da página de busca e o
 * atributo de revisões da postagem.
 */
import Extend from 'flarum/common/extenders';
import Post from 'flarum/common/models/Post';

import { SEARCH_ROUTE } from './search/route';

// A página vai num chunk próprio, carregado só quando a rota abre.
const SearchPage = () => import('./search/SearchPage');

export default [
  new Extend.Routes() //
    .add(SEARCH_ROUTE, '/search', SearchPage),

  new Extend.Model(Post) //
    .attribute<number>('canelaRevisionCount'),
];
