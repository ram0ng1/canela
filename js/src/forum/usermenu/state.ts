/*
 * Estado do menu do usuário: aberto ou fechado, a aba ativa e a rota em que
 * ele abriu. Fica fora dos componentes porque o botão do avatar, o painel e
 * os ouvintes globais (Esc, clique fora) precisam ler e mudar o mesmo valor —
 * e porque o cabeçalho pode ser redesenhado do zero ao trocar de página.
 */
import app from 'flarum/forum/app';

export const DEFAULT_TAB = 'all-notifications';

class UserMenuState {
  open = false;
  tab: string = DEFAULT_TAB;

  /** A rota de quando abriu: ao navegar, o menu fecha. */
  route: string | null = null;

  /** Devolver o foco ao avatar só quando quem fechou foi o teclado. */
  restoreFocus = false;

  show(): void {
    this.open = true;
    // O menu sempre reabre em "Todas as notificações".
    this.tab = DEFAULT_TAB;
    this.route = m.route.get();

    // Como o NotificationsDropdown do core: carregar a lista zera o contador
    // de novas (o número do avatar). Um erro já foi mostrado pelo pedido.
    Promise.resolve(app.notifications.load()).catch(() => {});
  }

  close(restoreFocus = false): void {
    if (!this.open) return;

    this.open = false;
    this.restoreFocus = restoreFocus;
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }
}

export const userMenu = new UserMenuState();
