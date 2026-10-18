/*
 * flarum/realtime na lista: em vez do aviso "1 discussão tem atividade nova e
 * será liberada em 2 segundos", a discussão simplesmente entra no topo da
 * lista (pedido do usuário). O tema pega o mesmo `onclick` do botão da
 * extensão — que libera as atualizações guardadas — e o chama na hora, sem
 * desenhar o aviso.
 *
 * Registrado no beforeMount para rodar depois do `contentItems` do realtime.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

export default function installRealtime(): void {
  app.beforeMount(() => {
    extend(IndexPage.prototype, 'contentItems', function (items: ItemList<Mithril.Children>) {
      if (!items.has('realtimeNewActivity')) return;

      const button = items.get('realtimeNewActivity') as any;
      const release = button?.attrs?.onclick;

      items.remove('realtimeNewActivity');

      // Fora do desenho atual: liberar redesenha a lista.
      if (typeof release === 'function') window.setTimeout(release, 0);
    });
  });
}
