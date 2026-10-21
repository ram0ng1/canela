/*
 * A gaveta do chat: presa ao canto de baixo à
 * direita, 400×530 por padrão, redimensionável pelo canto de cima à esquerda
 * (o tamanho fica guardado), recolhível até sobrar só a barra, e com a mesma
 * navegação da página cheia dentro dela.
 *
 * Não aparece na página cheia do chat nem no celular (lá o chat é sempre a
 * página cheia).
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import classList from 'flarum/common/utils/classList';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

import chat from '../ChatStore';
import { lazyComponent } from '../../../utils/lazy';
import { chatOn } from '../utils';

// O conteúdo da gaveta vem no chunk da interface do chat (./chatUi), só
// quando ela abre pela primeira vez.
const RouteView = lazyComponent(
  () => import('./chatUi').then((ui) => ui.default.RouteView),
  () => <LoadingIndicator />
);

const MIN_WIDTH = 250;
const MIN_HEIGHT = 300;

export default class ChatDrawer extends Component {
  private resizing: { x: number; y: number; width: number; height: number } | null = null;

  view(): Mithril.Children {
    const drawer = chat.drawer;
    const visible = chatOn() && drawer.open && !chat.isFullPage() && app.screen() !== 'phone';

    if (!visible) return <div className="chat-drawer-outlet-container" />;

    const width = Math.max(MIN_WIDTH, Math.min(drawer.width, window.innerWidth - 40));
    const height = Math.max(MIN_HEIGHT, Math.min(drawer.height, window.innerHeight - 80));

    return (
      <div className={classList('chat-drawer-outlet-container', { 'above-composer': app.composer?.isVisible?.() })}>
        <div
          className={classList('chat-drawer', drawer.expanded ? 'is-expanded' : 'is-collapsed')}
          style={drawer.expanded ? { width: `${width}px`, height: `${height}px` } : { width: `${width}px` }}
          data-chat-channel-id={'channelId' in drawer.route ? drawer.route.channelId : undefined}
          onkeydown={(e: KeyboardEvent) => this.onKeyDown(e)}
        >
          <div className="chat-drawer-container">
            <div className="chat-drawer-resizer" onpointerdown={(e: PointerEvent) => this.startResize(e)} />
            <RouteView route={drawer.route} inDrawer={true} />
          </div>
        </div>
      </div>
    );
  }

  /** Esc fecha a gaveta. */
  private onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if ((e.target as HTMLElement).closest('.Dropdown.open, .chat-composer-autocomplete')) return;

    e.preventDefault();
    chat.closeDrawer();
  }

  private startResize(e: PointerEvent): void {
    e.preventDefault();

    const drawer = this.element.querySelector('.chat-drawer') as HTMLElement;
    const rect = drawer.getBoundingClientRect();

    this.resizing = { x: e.clientX, y: e.clientY, width: rect.width, height: rect.height };
    drawer.classList.add('is-resizing');

    const move = (event: PointerEvent) => {
      if (!this.resizing) return;

      chat.drawer.width = Math.max(MIN_WIDTH, Math.min(window.innerWidth - 40, this.resizing.width + (this.resizing.x - event.clientX)));
      chat.drawer.height = Math.max(MIN_HEIGHT, Math.min(window.innerHeight - 80, this.resizing.height + (this.resizing.y - event.clientY)));
      drawer.style.width = `${chat.drawer.width}px`;
      drawer.style.height = `${chat.drawer.height}px`;
    };

    const up = () => {
      this.resizing = null;
      drawer.classList.remove('is-resizing');
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      chat.saveDrawer();
      m.redraw();
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }
}
