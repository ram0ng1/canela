/*
 * O menu aberto (abas e painéis) e a lista de notificações da página
 * /notifications: um chunk só, pedido quando o ponteiro ou o foco chega no
 * avatar (o clique quase sempre já o encontra pronto) ou quando a página de
 * notificações do core vai descer.
 */
import { once } from '../utils/chunkGate';

export const loadMenu = once(() => import('./menuChunk').then((mod) => mod.default));
