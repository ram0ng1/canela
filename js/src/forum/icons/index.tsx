/*
 * Camada única de ícones do tema: os ícones de interface do Meta.
 *
 * O meta.discourse.org desenha a interface com o Lucide (traço de 2px, pontas
 * redondas), pelo componente "Discourse Lucide Icons"; o Flarum desenha com o
 * Font Awesome sólido. Em vez de trocar ícone por ícone em cada tela (e em
 * cada extensão), o tema sobrescreve o `view` do componente `Icon` do core,
 * por onde passam o `icon=` dos botões, dos itens de menu, das notificações,
 * das extensões… Quando o nome está no mapa (iconMap.ts), sai um <svg> do
 * Lucide; fora do mapa (marcas, ícones raros de extensões, boa parte dos que o
 * admin escolhe para tags e grupos), continua o <i> do Font Awesome.
 *
 * O <svg> mantém as classes do <i> (`icon`, `Button-icon`, `fas fa-check`…):
 * o CSS do core, das extensões e do tema que mira essas classes (margens,
 * cor, `fa-spin`, `fa-fw`) continua valendo.
 */
import type Mithril from 'mithril';
import Icon from 'flarum/common/components/Icon';
import type { IIconAttrs } from 'flarum/common/components/Icon';
import { override } from 'flarum/common/extend';
import classList from 'flarum/common/utils/classList';
import type { IconNode } from 'lucide';

import { forumBool } from '../utils/settings';
import { lucideNameFor } from './iconMap';
import { GLYPHS } from './glyphs';

/** Atributos do <svg> do Lucide; o traço de 2 é o "medium", padrão do componente do Meta. */
const SVG_ATTRS: Record<string, string> = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

// O mesmo nome de ícone é desenhado dezenas de vezes por redraw (uma lista de
// tópicos inteira); a resolução do nome passa por apelidos e dois mapas, então
// fica guardada por classe.
const resolved = new Map<string, string | null>();

function resolve(classes: string): string | null {
  let name = resolved.get(classes);
  if (name === undefined) {
    name = lucideNameFor(classes);
    resolved.set(classes, name);
  }
  return name;
}

function glyph(name: string): IconNode | null {
  return GLYPHS[name] ?? null;
}

function enabled(): boolean {
  return forumBool('canelaLucideIcons', true);
}

/**
 * O desenho Lucide de uma classe do Font Awesome, ou `null` se ela continua no
 * Font Awesome (fora do mapa, ou a opção desligada no admin).
 */
export function lucideFor(classes: string): { name: string; node: IconNode } | null {
  if (!classes || !enabled()) return null;
  const name = resolve(classes);
  const node = name ? glyph(name) : null;
  return name && node ? { name, node } : null;
}

/**
 * Os elementos internos de um desenho, para quem monta o próprio <svg> (os
 * ícones fixos da casca e do menu do usuário, que são Lucide sempre).
 */
export function lucideChildren(name: string): Mithril.Children {
  const node = GLYPHS[name];
  // Uma cópia dos atributos a cada desenho: o Mithril avisa (e no próximo
  // major lança erro) quando o mesmo objeto volta num redraw.
  return node ? node.map(([tag, attrs]) => m(tag, { ...attrs })) : null;
}

function svgClass(classes: string, name: string, extra?: string): string {
  return classList('icon', classes, 'CanelaLucide', `lucide-${name}`, extra);
}

/**
 * Para os poucos lugares que montam HTML como texto (`innerHTML` em conteúdo
 * renderizado do post): a mesma regra do componente, em string.
 */
export function iconMarkup(classes: string, extraClass = ''): string {
  const found = lucideFor(classes);
  if (!found) return `<i aria-hidden="true" class="${classList('icon', classes, extraClass)}"></i>`;

  const attrs = Object.entries(SVG_ATTRS)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('');
  const children = found.node
    .map(([tag, childAttrs]) => {
      const list = Object.entries(childAttrs)
        .map(([key, value]) => ` ${key}="${String(value)}"`)
        .join('');
      return `<${tag}${list}/>`;
    })
    .join('');

  return `<svg class="${svgClass(classes, found.name, extraClass)}"${attrs}>${children}</svg>`;
}

export default function installIcons(): void {
  override(Icon.prototype, 'view', function (this: Icon, original: (vnode: Mithril.Vnode<IIconAttrs, Icon>) => Mithril.Children, vnode) {
    const { name, noStyleOverride, ...attrs } = vnode.attrs as IIconAttrs & Record<string, any>;

    // `icon={true}` no Button desenha um <i> vazio só para reservar o espaço
    // (o item não marcado de um menu): não há o que trocar.
    const found = typeof name === 'string' ? lucideFor(name) : null;
    if (!found) return original(vnode);

    return (
      <svg {...SVG_ATTRS} {...attrs} className={svgClass(name, found.name, attrs.className)}>
        {/* Cópia dos atributos: o objeto do GLYPHS é o mesmo em todo redraw. */}
        {found.node.map(([tag, childAttrs]) => m(tag, { ...childAttrs }))}
      </svg>
    );
  });
}
