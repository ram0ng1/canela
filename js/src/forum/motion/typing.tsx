/*
 * "Fulano está digitando…" do flarum-realtime com as reticências que ondulam
 * (`.presence-users .wave .dot`, 1,8s): os três
 * pontos sobem um depois do outro, no lugar do ícone "…" pulsando.
 *
 * Na lista de tópicos, o ponto pulsante do realtime (`fas fa-ellipsis-h
 * fa-beat`, na cor primária) vira uma pílula discreta no estilo das
 * etiquetas: a caneta e as mesmas reticências (`typingPill`, usada pela linha
 * da lista em list/listItem.tsx).
 */
import { extend } from 'flarum/common/extend';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';

function wave() {
  return (
    <span className="CanelaWave" aria-hidden="true">
      <span className="CanelaWave-dot">.</span>
      <span className="CanelaWave-dot">.</span>
      <span className="CanelaWave-dot">.</span>
    </span>
  );
}

/** A pílula "alguém está digitando" da lista de tópicos. */
export function typingPill(label: string): Mithril.Children {
  return (
    <span className="CanelaTyping" role="status" aria-label={label} title={label}>
      <Icon name="fas fa-pen" className="CanelaTyping-icon" />
      {wave()}
    </span>
  );
}

export default function installTyping() {
  // Só existe com o flarum-realtime; sem ele o onLoad nunca dispara.
  extend('ext:flarum/realtime/forum/components/TypingIndicator' as any, 'view', function (this: unknown, vdom: Mithril.Vnode<any, any>) {
    const className = String(vdom?.attrs?.className || '');

    if (!className.includes('TypingUsersContainer-active')) return;

    const users = (vdom.children as Mithril.Vnode<any, any>[] | undefined)?.find(
      (child) => child && String(child.attrs?.className || '').includes('TypingUsers')
    );

    if (!users || !Array.isArray(users.children)) return;

    // O primeiro filho é o ícone; o texto vem depois e as reticências no fim.
    users.children = users.children.slice(1).concat(wave());
  });
}
