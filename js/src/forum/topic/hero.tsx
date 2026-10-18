/*
 * Cabeçalho do tópico: o título grande e, embaixo, a categoria e as
 * etiquetas, como o Discourse — sem a faixa colorida que o flarum/tags pinta
 * com a cor da primeira tag. Os ícones de status do core (fixado, trancado…)
 * continuam antes do título.
 */
import { extend } from 'flarum/common/extend';
import DiscussionHero from 'flarum/forum/components/DiscussionHero';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { discussionBadges } from '../utils/tags';

/** Classes que o flarum/tags põe no hero para pintá-lo com a cor da tag. */
const COLORED_CLASS = /^(DiscussionHero--colored|text-contrast--\w+)$/;

export default function installHero(): void {
  extend(DiscussionHero.prototype, 'items', function (this: DiscussionHero, items: ItemList<Mithril.Children>) {
    // O rótulo de tags do flarum/tags vira a linha de badges do Discourse,
    // depois do título e não antes.
    if (items.has('tags')) items.remove('tags');

    const badges = discussionBadges(this.attrs.discussion);

    if (badges) {
      items.add('canelaBadges', <div className="CanelaTopicHero-badges">{badges}</div>, -10);
    }
  });

  extend(DiscussionHero.prototype, 'view', function (this: DiscussionHero, vnode: any) {
    if (!vnode || !vnode.attrs) return;

    // O título mora no cartão branco: a cor da tag como fundo não combina, e o
    // contraste calculado pelo tags deixaria o texto branco sobre branco.
    delete vnode.attrs.style;

    vnode.attrs.className = String(vnode.attrs.className || '')
      .split(' ')
      .filter((name: string) => name && !COLORED_CLASS.test(name))
      .concat('CanelaTopicHero')
      .join(' ');
  });
}
