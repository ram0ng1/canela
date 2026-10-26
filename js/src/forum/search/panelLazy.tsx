/*
 * O chunk do painel do menu de busca (SearchPanel + motor da busca). O campo
 * do cabeçalho está no pacote principal; o painel desce no ocioso do boot, no
 * hover/toque/foco do campo, ou quando o painel abre — o que vier primeiro.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';

import { once } from '../utils/chunkGate';
import type SearchMenu from './SearchMenu';

type Panel = typeof import('./SearchPanel');

let loaded: Panel | null = null;

const load = once(() =>
  import('./SearchPanel').then((panel) => {
    loaded = panel;

    return panel;
  })
);

let idleQueued = false;

/** `idle`: espera o navegador ficar ocioso (fora da primeira pintura); senão, já. */
export function preloadSearchPanel(opts?: { idle?: boolean } | Event): void {
  if (loaded) return;

  if (opts && !(opts instanceof Event) && opts.idle) {
    if (idleQueued) return;
    idleQueued = true;

    const run = () => load().catch(() => {});
    const idle = window.requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;

    if (idle) idle(run, { timeout: 4000 });
    else window.setTimeout(run, 2000);

    return;
  }

  load().catch(() => {});
}

/** Roda já se o chunk chegou (sem perder o redesenho do evento); senão, quando chegar. */
export function withSearchPanel(run: (panel: Panel) => void): void {
  if (loaded) {
    run(loaded);
    return;
  }

  load()
    .then((panel) => {
      run(panel);
      m.redraw();
    })
    .catch(() => {});
}

export interface SearchPanelSlotAttrs extends ComponentAttrs {
  menu: SearchMenu;
}

/** O painel, se o chunk já chegou; senão nada até ele chegar (normalmente já chegou). */
export class SearchPanelSlot extends Component<SearchPanelSlotAttrs> {
  oninit(vnode: Mithril.Vnode<SearchPanelSlotAttrs, this>) {
    super.oninit(vnode);

    if (!loaded)
      load().then(
        () => m.redraw(),
        () => {}
      );
  }

  view(): Mithril.Children {
    const Panel = loaded?.default;

    return Panel ? <Panel menu={this.attrs.menu} /> : null;
  }
}
