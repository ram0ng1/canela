/*
 * ramon/marketplace no visual do tema, sem editar a extensão (feita para o
 * tema avocado):
 *
 * - sidebar: os links da loja viram a seção recolhível "Loja" da barra lateral.
 * - pages: as páginas no cartão do tema, com o título por cima como os heros,
 *   e os `<i>` crus da extensão trocados pelos ícones Lucide.
 * - categories: as abas de categoria da vitrine e o filtro da rota /shop/category.
 * - cartDropdown: a setinha do menu do carrinho apontando para o ícone.
 * - skeleton: o carregamento de cada tela no leiaute do tema.
 * - icons: os ícones de comércio (loja, carrinho, recibo…) no mapa do Lucide.
 * - O visual (tokens `--mp-*` derivados dos `--cn-*`, botões, campos, pílulas,
 *   abas, tabelas, modais): less/forum/thirdparty/Marketplace.less, que só
 *   compila com a extensão habilitada e a integração ligada no admin.
 *
 * As chaves do admin são lidas na hora de desenhar (thirdParty.marketplace*).
 */
import installMarketplaceCartDropdown from './cartDropdown';
import installMarketplaceCategories from './categories';
import installMarketplaceIcons from './icons';
import installMarketplacePages from './pages';
import installMarketplaceSidebar from './sidebar';
import installMarketplaceSkeletons from './skeleton';

export default function installMarketplace(): void {
  installMarketplaceIcons();
  installMarketplacePages();
  installMarketplaceCategories();
  installMarketplaceSidebar();
  installMarketplaceCartDropdown();
  installMarketplaceSkeletons();
}
