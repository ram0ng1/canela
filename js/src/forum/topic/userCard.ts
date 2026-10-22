/*
 * Avatar e nome do autor abrem o cartão de usuário no clique, no lugar do cartão do core que aparece ao passar o mouse.
 * Ao passar o mouse (ou focar), os dados do cartão já começam a chegar: no
 * clique, ele abre na hora e inteiro.
 */
import { override } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';

import { openUserCard, prefetchUserCard } from './components/UserCardPopover';
import { topicSettings } from './ui';

const TRIGGERS = '.Post-side .Post-avatar, .PostUser-name a';

export default function installUserCard(): void {
  override(CommentPost.prototype, 'listenForCard', function (this: any, original: () => void) {
    if (!topicSettings.userCard()) return original();

    const prefetch = (event: Event) => {
      const user = this.attrs.post.user();

      if (user && (event.target as HTMLElement).closest?.(TRIGGERS)) prefetchUserCard(user);
    };

    this.element.addEventListener('pointerover', prefetch);
    this.element.addEventListener('focusin', prefetch);

    // Na fase de captura: o clique para aqui, antes de o Link do avatar
    // navegar para o perfil.
    this.element.addEventListener(
      'click',
      (event: MouseEvent) => {
        const trigger = (event.target as HTMLElement).closest<HTMLElement>(TRIGGERS);

        if (!trigger || !this.element.contains(trigger)) return;

        // Ctrl/Cmd+clique continua abrindo o perfil numa aba nova.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const user = this.attrs.post.user();

        if (!user) return;

        event.preventDefault();
        event.stopPropagation();

        // O cartão se alinha ao avatar da coluna; no celular ele está escondido
        // e quem serve de âncora é o avatar do cabeçalho.
        const sideAvatar = this.element.querySelector('.Post-side .Post-avatar') as HTMLElement | null;
        const anchor = sideAvatar && sideAvatar.offsetParent !== null ? sideAvatar : trigger;

        openUserCard(user, anchor);
      },
      true
    );
  });
}
