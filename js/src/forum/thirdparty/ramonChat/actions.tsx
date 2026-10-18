/*
 * A barra de ações da mensagem como a do chat do tema (chat-message-actions):
 * à vista só as reações (o "curtir" do ramon/chat e as rápidas dos recursos),
 * o fio e o responder; o resto — copiar link, editar, fixar, salvar,
 * selecionar, denunciar, excluir — vai para o "⋮", nesta ordem.
 *
 * Instalado no `mount` do app, depois dos recursos (./features), que também
 * acrescentam botões à barra: o "⋮" agrupa os deles junto.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';

import { thirdParty } from '../settings';

/** Os que ficam à vista: as reações, o fio e o responder. */
function isPrimary(item: any): boolean {
  const icon = String(item?.attrs?.icon || '');
  const className = String(item?.attrs?.className || '');

  return /CanelaRamonChat-quickReaction|CanelaRamonChat-reactPicker/.test(className) || /fa-thumbs-up|fa-reply|fa-comments/.test(icon);
}

/** A ordem do "⋮" do chat do tema. */
const ORDER = [/fa-link/, /fa-pencil|fa-pen\b/, /fa-thumbtack/, /fa-bookmark/, /fa-list-check/, /fa-flag/, /fa-trash/];

function rank(item: any): number {
  const icon = String(item?.attrs?.icon || '');
  const index = ORDER.findIndex((pattern) => pattern.test(icon));

  return index === -1 ? ORDER.length - 2 : index;
}

function label(item: any): string {
  const attrs = item?.attrs || {};

  return String(attrs['aria-label'] || attrs.title || '');
}

let installed = false;

export default function installRamonChatActions(): void {
  if (installed) return;
  installed = true;

  extend('ext:ramon/chat/forum/components/ChatMessage' as any, 'actions', function (vnode: any) {
    if (!vnode || typeof vnode !== 'object' || !thirdParty.ramonChat() || !Array.isArray(vnode.children)) return;

    const items = vnode.children.filter(Boolean);
    const primary = items.filter(isPrimary);
    const secondary = items.filter((item: any) => !isPrimary(item)).sort((a: any, b: any) => rank(a) - rank(b));

    if (!secondary.length) return;

    const more = (
      <Dropdown
        className="ChatMessage-more"
        buttonClassName="ChatMessage-action ChatMessage-moreToggle"
        menuClassName="Dropdown-menu--right"
        icon="fas fa-ellipsis-vertical"
        label=""
        caretIcon=""
        accessibleToggleLabel={app.translator.trans('ramon-canela.forum.chat.more_message_actions', {}, true)}
      >
        {secondary.map((item: any) => (
          <Button
            icon={item.attrs?.icon}
            className={item.attrs?.className?.includes('danger') ? 'Button--danger-text' : undefined}
            disabled={item.attrs?.disabled}
            onclick={(e: Event) => item.attrs?.onclick?.(e)}
          >
            {label(item)}
          </Button>
        ))}
      </Dropdown>
    );

    // Sem chaves: os botões do ramon/chat e dos recursos não têm, e o Mithril
    // não aceita uma lista misturada.
    primary.forEach((item: any) => (item.key = undefined));
    vnode.children = [...primary, more];
  });
}
