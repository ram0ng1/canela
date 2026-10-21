/*
 * Os ícones das abas e do rodapé do menu do usuário, desenhados com o
 * Lucide — traço de 2px, pontas redondas —, que o Font Awesome
 * do Flarum não tem com o mesmo traço. A classe base `.CanelaIcon` (da casca,
 * Header.less) dá o traço; o tamanho vem do UserMenu.less.
 */
import type Mithril from 'mithril';

import { lucideChildren } from '../icons';

function svg(name: string, children: Mithril.Children): Mithril.Children {
  return (
    <svg className={`CanelaIcon CanelaIcon--${name}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

// Nome da aba → desenho do Lucide (icons/glyphs.ts).
const PATHS: Record<string, string> = {
  bell: 'bell',
  reply: 'reply',
  heart: 'heart',
  mail: 'mail',
  bookmark: 'bookmark',
  // O balão do chat.
  chat: 'message-square-text',
  // A aba "outras": uma grade 2×2.
  other: 'grid-2x2',
  flag: 'flag',
  user: 'user',
  chevronDown: 'chevron-down',
  check: 'check',
};

export type UserMenuIconName = keyof typeof PATHS;

export function menuIcon(name: string): Mithril.Children {
  const paths = PATHS[name];

  return paths ? svg(name, lucideChildren(paths)) : null;
}
