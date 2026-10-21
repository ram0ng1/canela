/*
 * A lista de tópicos: ordenações novas, linha em colunas,
 * cabeçalho, barra de navegação, os heróis da página inicial e a página de
 * categorias. Chamada uma vez no initializer do fórum.
 */
import installSorts from './sorts';
import installListItem from './listItem';
import installListHeader from './listHeader';
import installNavigation from './navigation';
import installHero from './hero';
import installCategoriesPage from './categoriesPage';
import installInfiniteScroll from './infiniteScroll';
import installRoutes from './routes';

export function installList(): void {
  installRoutes();
  installSorts();
  installListItem();
  installListHeader();
  installNavigation();
  installHero();
  installCategoriesPage();
  installInfiniteScroll();
}

export default installList;
