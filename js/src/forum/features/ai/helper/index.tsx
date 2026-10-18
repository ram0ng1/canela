/*
 * O ajudante de IA do editor: o botão ✨ entra na barra do TextEditor, ao
 * lado dos botões de formatação. Só se estende a ItemList — o editor tem
 * outro dono, e o que outras extensões põem na barra continua lá.
 *
 * A configuração é lida a cada desenho (o admin pode mudar), e o botão some
 * para quem não pode usar a IA.
 */
import { extend } from 'flarum/common/extend';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import TextEditor from 'flarum/common/components/TextEditor';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { aiUsable } from '../state';
import { t } from '../../../utils/settings';
import { once } from '../../../utils/chunkGate';

// O menu do ajudante é um chunk, pedido quando o editor aparece com a IA
// ligada. Até chegar, o mesmo botão; um clique nesse meio tempo abre o menu
// assim que ele chega.
const loadHelper = once(() => import('./HelperMenu').then((mod) => mod.default));
let HelperMenu: any = null;
let openWhenReady = false;

class HelperTrigger extends Component<ComponentAttrs & { editor: TextEditor }> {
  oninit(vnode: Mithril.Vnode<ComponentAttrs & { editor: TextEditor }, this>) {
    super.oninit(vnode);

    if (!HelperMenu) {
      loadHelper()
        .then((menu) => (HelperMenu = menu))
        .catch(() => {})
        .finally(() => m.redraw());
    }
  }

  view() {
    if (HelperMenu) {
      const initiallyOpen = openWhenReady;
      openWhenReady = false;

      return <HelperMenu editor={this.attrs.editor} initiallyOpen={initiallyOpen} />;
    }

    return (
      <span className="CanelaAiHelper">
        <Button
          className="Button Button--icon Button--link ai-helper-trigger"
          icon="fas fa-wand-magic-sparkles"
          title={t('ai.helper.trigger')}
          aria-label={t('ai.helper.trigger')}
          aria-expanded="false"
          onclick={() => (openWhenReady = true)}
        />
      </span>
    );
  }
}

export default function installHelper(): void {
  extend(TextEditor.prototype, 'toolbarItems', function (this: TextEditor, items: ItemList<Mithril.Children>) {
    if (!aiUsable('helper') || !(this.attrs as any)?.composer) return;

    items.add('canelaAiHelper', <HelperTrigger editor={this} />, -50);
  });
}
