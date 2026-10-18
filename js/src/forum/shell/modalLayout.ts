import { extend } from 'flarum/common/extend';
import type Mithril from 'mithril';

/**
 * Modais de formulário longo (less/forum/ModalLayout.less): o CSS distribui
 * os campos em colunas por assunto, mas os itens do core não têm classe que
 * diga qual campo é qual (nome de usuário e e-mail são `.Form-group` iguais).
 * Aqui cada item do ItemList ganha `data-item="<chave>"` na hora de desenhar;
 * nada muda na lógica nem na gravação, e um campo de extensão sem regra só
 * cai na próxima vaga livre da grade.
 */
const MODALS = ['flarum/common/components/EditUserModal'];

function tagItems(children: unknown, depth = 0): void {
  if (!Array.isArray(children) || depth > 4) return;

  for (const child of children) {
    if (!child || typeof child !== 'object') continue;

    const vnode = child as Mithril.Vnode<Record<string, unknown>> & { itemName?: string };

    // `toArray()` põe o `itemName` nos itens; só elementos HTML recebem o
    // atributo (num componente ele iria parar nos attrs dele, não no DOM).
    if (typeof vnode.itemName === 'string' && typeof vnode.tag === 'string' && vnode.attrs && typeof vnode.attrs === 'object') {
      vnode.attrs['data-item'] = vnode.itemName;
      continue;
    }

    tagItems(vnode.children, depth + 1);
  }
}

export default function installModalLayout(): void {
  // Módulos carregados sob demanda: estendidos pelo nome.
  for (const module of MODALS) {
    extend(module as any, 'content', function (vdom: Mithril.Children) {
      tagItems([vdom]);
    });
  }
}
