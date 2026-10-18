/*
 * A interface do chat que só aparece com a gaveta aberta ou na página /chat:
 * as duas pedem este módulo com import(), então tudo (canal, mensagens,
 * editor, listas, informações do canal) vai num chunk só e fica fora do
 * forum.js. O que aparece sempre (ícone do cabeçalho, seções da barra
 * lateral, contagens) continua no pacote principal.
 */
import ChatPage from './ChatPage';
import RouteView from './RouteView';

export default { ChatPage, RouteView };
