/*
 * "Fulano está digitando…" do flarum-realtime com as reticências que ondulam
 * (`.presence-users .wave .dot`, 1,8s): os três
 * pontos sobem um depois do outro, no lugar do ícone "…" pulsando.
 */
import { extend } from 'flarum/common/extend';
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
