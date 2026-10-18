/*
 * Recursos "extras" do Discourse: página de busca avançada, seleção em massa,
 * "Melhores" por período, tamanho do texto, banner de anúncio, imprimir tópico
 * e histórico de edições.
 *
 * Cada um confere a própria configuração (`canela*Enabled`) na hora de
 * desenhar — no initializer o fórum ainda não carregou as configurações —,
 * então todos são instalados sempre e somem sozinhos quando desligados.
 */
import installSearchPage from './search';
import installBulkSelect from './bulk';
import installTopPeriods from './topPeriods';
import installTextSize from './textSize';
import installBanner from './banner';
import installPrint from './print';
import installPostHistory from './history';

export function installExtras(): void {
  installSearchPage();
  installBulkSelect();
  installTopPeriods();
  installTextSize();
  installBanner();
  installPrint();
  installPostHistory();
}

export default installExtras;
