/*
 * Avatar nítido em qualquer tamanho.
 *
 * O core guarda o avatar em 100, 200 e 300 px e o `srcset` escolhe pela
 * densidade da tela (1x, 2x, 3x), não pelo tamanho em que ele aparece: o
 * avatar grande do perfil (144 px) e o do cartão do usuário (128 px) pegavam
 * a versão de 100 px numa tela comum e a de 200 px numa tela 2x, esticadas
 * e borradas. Aqui o `srcset` passa a dizer a largura de cada versão (100w,
 * 200w, 300w) e o `sizes`, o tamanho exibido; o navegador faz a conta com a
 * densidade e baixa a menor que serve.
 *
 * O `sizes` real só se sabe depois do layout: ele entra no oncreate. Como o
 * avatar é `loading="lazy"`, o download espera o layout e já sai com ele.
 */
import { extend, override } from 'flarum/common/extend';
import Avatar from 'flarum/common/components/Avatar';
import type Mithril from 'mithril';

/** A largura da versão 1x do core (AvatarUploader). */
const BASE_WIDTH = 100;

/** Até medir: o tamanho mais comum nas listas, que pega a mesma versão de antes. */
const DEFAULT_SIZES = '48px';

/** "a.webp 1x, a@2x.webp 2x" → "a.webp 100w, a@2x.webp 200w"; null se não for por densidade. */
function widthSrcset(srcset: string): string | null {
  const entries = srcset.split(',').map((entry) => entry.trim().match(/^(\S+)\s+(\d+(?:\.\d+)?)x$/));

  if (!entries.length || entries.some((entry) => !entry)) return null;

  return entries.map((entry) => `${entry![1]} ${Math.round(Number(entry![2]) * BASE_WIDTH)}w`).join(', ');
}

function fitSizes(element: Element | undefined): void {
  if (!(element instanceof HTMLImageElement) || !/\s\d+w(,|$)/.test(element.srcset)) return;

  const width = Math.round(element.getBoundingClientRect().width);

  if (width > 0 && element.sizes !== `${width}px`) element.sizes = `${width}px`;
}

export default function installAvatarSizes(): void {
  override(Avatar.prototype, 'view', function (this: Avatar, original: (vnode: Mithril.Vnode) => Mithril.Children, vnode: Mithril.Vnode) {
    const result: any = original(vnode);
    const attrs = result?.tag === 'img' ? result.attrs : null;
    const srcset = attrs && (attrs.srcSet || attrs.srcset);
    const converted = typeof srcset === 'string' ? widthSrcset(srcset) : null;

    if (converted) {
      delete attrs.srcSet;
      attrs.srcset = converted;
      attrs.sizes ??= DEFAULT_SIZES;
    }

    return result;
  });

  extend(Avatar.prototype, ['oncreate', 'onupdate'], function (this: Avatar, _result: unknown, vnode: Mithril.VnodeDOM) {
    fitSizes(vnode.dom);
  });
}
