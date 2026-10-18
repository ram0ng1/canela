/*
 * Os ícones das abas e do rodapé do menu do usuário. O Meta (Horizon) os
 * desenha com o Lucide — traço de 2px, pontas redondas —, que o Font Awesome
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

// Nome da aba → desenho do Lucide (icons/glyphs.ts, os mesmos do sprite do Meta).
const PATHS: Record<string, string> = {
  bell: 'bell',
  reply: 'reply',
  heart: 'heart',
  mail: 'mail',
  bookmark: 'bookmark',
  // O "d-chat" do Discourse.
  chat: 'message-square-text',
  // O "discourse-other-tab" do Discourse: uma grade 2×2.
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
