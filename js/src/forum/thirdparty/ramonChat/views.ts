/*
 * Ajustes nas telas do próprio ramon/chat, sem mexer na extensão: cada
 * `view()` dele passa por aqui depois de desenhada (o `extend` pelo nome do
 * módulo, que também alcança os do chunk `chatUi`, carregados sob demanda).
 *
 * - Ícones: o ramon/chat desenha boa parte dos ícones como `<i class="fas
 *   fa-x">` cru, por fora do componente `Icon` — que é por onde o tema troca
 *   o Font Awesome pelo Lucide. Aqui esses `<i>` viram `Icon`, e o
 *   chat inteiro fica com o mesmo traço do resto do fórum.
 * - Hora da mensagem: "há 3 minutos" vira "14:35" (de outro dia, "13 out
 *   14:35"), com a data completa no title.
 * - Editor: o textarea cresce com o texto até o max-height do CSS e só então
 *   rola; enquanto cabe, sem barra de rolagem (o Windows desenha a barra
 *   clássica, com setas, num `overflow: auto` mesmo quando sobra um pixel).
 */
import Icon from 'flarum/common/components/Icon';
import { extend } from 'flarum/common/extend';
import type Mithril from 'mithril';

import { lucideFor } from '../../icons';
import { formatWith } from '../../utils/dates';
import { thirdParty } from '../settings';

/** Os componentes do ramon/chat com `<i>` cru (o resto já usa `Icon` ou `icon=`). */
const COMPONENTS = [
  'AddMembersModal',
  'BookmarksList',
  'BrowseChannelsPage',
  'ChannelFormModal',
  'ChannelInfoModal',
  'ChannelInviteNotification',
  'ChannelRanksTab',
  'ChannelView',
  'ChatAutocomplete',
  'ChatComposer',
  'ChatDrawerPanel',
  'ChatMessage',
  'ChatSearch',
  'ChatSidebar',
  'EmojiPicker',
  'ErrorBoundary',
  'FlaggedMessagesList',
  'PinnedPanel',
  'ThreadPanel',
  'ThreadsList',
];

const FA_CLASS = /(^|\s)fa-[a-z0-9-]+/;

type AnyVnode = Mithril.Vnode<any, any> & { attrs?: Record<string, any>; children?: any };

/** O `<i>` do Font Awesome que o tema sabe desenhar com o Lucide, como um `Icon`. */
function asIcon(vnode: AnyVnode): Mithril.Vnode | null {
  if (!vnode || typeof vnode !== 'object' || vnode.tag !== 'i') return null;

  const classes = String(vnode.attrs?.className || vnode.attrs?.class || '');

  if (!FA_CLASS.test(classes) || !lucideFor(classes)) return null;

  const { className, class: _class, ...rest } = vnode.attrs || {};

  return m(Icon as any, { ...rest, key: vnode.key, name: classes });
}

/** Troca, no lugar, os `<i>` da árvore devolvida pelo `view()` (o ramon/marketplace usa o mesmo). */
export function lucidify(children: unknown): void {
  if (!Array.isArray(children)) return;

  for (let i = 0; i < children.length; i++) {
    const child = children[i] as AnyVnode;
    const icon = asIcon(child);

    if (icon) children[i] = icon;
    else if (child && typeof child === 'object') lucidify(Array.isArray(child) ? child : child.children);
  }
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "14:35" hoje; "13 out 14:35" em outro dia. */
export function messageTime(date: Date): string {
  const time = formatWith(date, { hour: '2-digit', minute: '2-digit' });

  if (startOfDay(date) === startOfDay(new Date())) return time;

  return `${formatWith(date, { day: 'numeric', month: 'short' })
    .replace(/\./g, '')
    .replace(/\sde\s/g, ' ')} ${time}`;
}

/** Acha o primeiro vnode com esta classe (a árvore de uma mensagem é pequena). */
export function findByClass(node: unknown, className: string): AnyVnode | null {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByClass(child, className);
      if (found) return found;
    }

    return null;
  }

  const vnode = node as AnyVnode;
  const classes = String(vnode.attrs?.className || '');

  if (typeof vnode.tag === 'string' && classes.split(/\s+/).includes(className)) return vnode;

  return findByClass(vnode.children, className);
}

export default function installRamonChatViews(): void {
  COMPONENTS.forEach((name) => {
    extend(`ext:ramon/chat/forum/components/${name}` as any, 'view', function (vnode: Mithril.Children) {
      if (thirdParty.ramonChat()) lucidify([vnode]);
    });
  });

  extend('ext:ramon/chat/forum/components/ChatMessage' as any, 'view', function (this: any, vnode: Mithril.Children) {
    if (!thirdParty.ramonChat()) return;

    const date: Date | null | undefined = this.attrs?.message?.createdAt?.();
    const slot = date ? findByClass(vnode, 'ChatMessage-time') : null;

    if (!slot || !date) return;

    (slot as any).text = undefined;
    slot.children = [
      m(
        'time',
        { datetime: date.toISOString(), title: formatWith(date, { dateStyle: 'full', timeStyle: 'short' } as Intl.DateTimeFormatOptions) },
        messageTime(date)
      ),
    ];
  });

  extend('ext:ramon/chat/forum/components/ChatComposer' as any, 'resize', function (this: any) {
    const el: HTMLTextAreaElement | null | undefined = this.textarea;

    if (!el || !thirdParty.ramonChat()) return;

    el.style.overflowY = el.scrollHeight > el.clientHeight + 1 ? 'auto' : 'hidden';
  });
}
