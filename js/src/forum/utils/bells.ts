/*
 * Os sinos dos níveis de notificação, como no Discourse (componente "Discourse
 * Lucide Icons"): acompanhando com ondas, monitorando com o ponto, normal o
 * sino simples e silenciado cortado.
 *
 * No Lucide o `fas`/`far fa-bell` saem iguais, então o botão não mudava ao
 * trocar o nível. Sem o Lucide (opção desligada no admin), o sino cheio do
 * Font Awesome já se distingue do vazado.
 */
import { forumBool } from './settings';

export type BellLevel = 'watching' | 'tracking' | 'normal' | 'muted';

export function bellIcon(level: BellLevel): string {
  const lucide = forumBool('canelaLucideIcons', true);

  switch (level) {
    case 'watching':
      return lucide ? 'fas fa-bell-ring' : 'fas fa-bell';
    case 'tracking':
      return lucide ? 'fas fa-bell-dot' : 'far fa-bell';
    case 'muted':
      return 'fas fa-bell-slash';
    default:
      return 'far fa-bell';
  }
}
