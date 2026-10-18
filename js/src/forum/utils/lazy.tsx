/*
 * Componentes em chunk próprio (import() sob demanda): o código só desce
 * quando o componente aparece pela primeira vez, em vez de pesar no forum.js
 * da primeira carga. O chunk é pedido uma vez só; as próximas instâncias
 * desenham na hora.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';

type Loaded = Mithril.ComponentTypes<any, any>;

/**
 * Um componente que desenha `placeholder` até o chunk chegar e, daí em
 * diante, o componente de verdade com os mesmos atributos e filhos.
 * Se o download falhar, tenta de novo na próxima vez que aparecer.
 */
export function lazyComponent<Attrs extends ComponentAttrs = any>(
  load: () => Promise<Loaded>,
  placeholder: () => Mithril.Children = () => null
): typeof Component<Attrs> {
  let loaded: Loaded | null = null;
  let pending: Promise<void> | null = null;

  const fetch = () => {
    pending ||= load().then(
      (component) => {
        loaded = component;
        m.redraw();
      },
      () => {
        pending = null;
      }
    );
  };

  return class LazyComponent extends Component<Attrs> {
    oninit(vnode: Mithril.Vnode<Attrs, Component<Attrs>>) {
      super.oninit(vnode);

      if (!loaded) fetch();
    }

    view(vnode: Mithril.Vnode<Attrs, Component<Attrs>>) {
      const Comp = loaded as any;

      return Comp ? <Comp {...vnode.attrs}>{vnode.children}</Comp> : placeholder();
    }
  };
}
