/*
 * Dica (Tooltip do core) nos botões da barra de ações do post que mostram só
 * o ícone: marcador, solução, curtir, link, "…" e os de outras extensões. O
 * `title` nativo demorava a aparecer e não seguia o visual do tema.
 *
 * Roda por último (beforeMount registrado no fim do initializer do tema), para
 * enxergar os botões que os recursos e as extensões já puseram na barra.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Tooltip from 'flarum/common/components/Tooltip';
import CommentPost from 'flarum/forum/components/CommentPost';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

/** Um botão só de ícone, com a descrição que a dica vai mostrar. */
function iconOnlyLabel(vnode: any): string | null {
  if (!vnode || typeof vnode !== 'object' || vnode.tag !== Button || !vnode.attrs) return null;

  const className = String(vnode.attrs.className || '');

  if (!/\bButton--icon\b/.test(className)) return null;

  const label = vnode.attrs.title || vnode.attrs['aria-label'];

  return typeof label === 'string' && label ? label : null;
}

export default function installActionTooltips(): void {
  app.beforeMount(() => {
    extend(CommentPost.prototype, 'actionItems', function (items: ItemList<Mithril.Children>) {
      Object.keys(items.toObject()).forEach((key) => {
        const vnode: any = items.get(key);
        const label = iconOnlyLabel(vnode);

        if (!label) return;

        const className = String(vnode.attrs.className || '');

        // A dica toma o lugar do `title` nativo (senão apareciam os dois).
        vnode.attrs = { ...vnode.attrs, title: undefined, 'aria-label': label };

        items.setContent(
          key,
          // Logo depois de copiar o link, o retorno "Link copiado!" ocupa o
          // lugar da dica em cima do botão.
          <Tooltip text={label} tooltipVisible={/\bCanelaPostAction--copied\b/.test(className) ? false : undefined}>
            {vnode}
          </Tooltip>
        );
      });
    });
  });
}
