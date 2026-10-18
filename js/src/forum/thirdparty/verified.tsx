/*
 * ramon/verified no visual do Discourse.
 *
 * A extensão põe o selo como um item próprio do cabeçalho do post
 * (`headerItems.verified`), como um <ul> extra na prévia da resposta
 * (ReplyPlaceholder) e embrulhando o `identity` do UserCard num <h1>. No tema
 * isso caía antes do nome (o cabeçalho ordena os itens com `order`), e no
 * perfil virava um <h1> dentro de outro, com o selo numa linha própria.
 *
 * Aqui o selo vira um "ícone depois do nome" (utils/userIcons): depois do
 * nome em negrito, na linha do texto e do tamanho dele, antes do emoji de
 * status, em todas as telas do tema que mostram o nome (post, post embutido,
 * "em resposta a", cartão, perfil). Os itens da extensão somem: o do post e
 * o da prévia pelo CSS (html.CanelaVerified), o do perfil desembrulhado aqui.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import UserCard from 'flarum/forum/components/UserCard';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { extModule, thirdParty } from './settings';
import { registerUserIcon, type UserIconContext } from '../utils/userIcons';

/** Onde o selo vai sem o popover: dentro de um botão não cabe outro clicável. */
const PLAIN: UserIconContext[] = ['replyTo', 'mention', 'list', 'menu'];

function isVerified(user: User): boolean {
  // O método vem do model da extensão: sem ela, ele nem existe.
  const method = (user as any).isVerified;

  return typeof method === 'function' && !!method.call(user);
}

function badgeComponent(): any {
  const module = extModule('ramon-verified', 'common/components/VerifiedBadge');

  return module ? ((module as any).default ?? module) : null;
}

export default function installVerified(): void {
  registerUserIcon(
    'verified',
    (user, context) => {
      if (!thirdParty.verified() || !isVerified(user)) return null;

      const Badge = badgeComponent();

      if (!Badge) return null;

      return <Badge user={user} plain={PLAIN.includes(context)} className="VerifiedBadge--canela" />;
    },
    100
  );

  // Registrado na montagem, antes do primeiro desenho mas depois do
  // initializer da extensão (prioridade -100): assim este extend roda depois
  // do dela e desfaz o <h1> que ela pôs em volta do nome do perfil.
  override(app as any, 'mount', function (this: any, original: (...args: unknown[]) => unknown, ...args: unknown[]) {
    if (thirdParty.verified()) {
      document.documentElement.classList.add('CanelaVerified');
      unwrapProfileIdentity();
    }

    return original(...args);
  });
}

function unwrapProfileIdentity(): void {
  extend(UserCard.prototype, 'contentItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!/\bUserHero\b/.test(this.attrs?.className || '') || !items.has('identity')) return;

    const item = items.get('identity') as any;

    // A extensão troca o bloco de nomes do tema por um <h1> com a mesma
    // classe e os filhos dele + o selo. Volta a ser o <div> do tema só com os
    // filhos originais: o selo já está na linha do nome (installProfile).
    if (item?.tag === 'h1' && /\bCanelaUserHero-names\b/.test(item.attrs?.className || '') && Array.isArray(item.children)) {
      items.setContent('identity', m('div', { className: item.attrs.className }, item.children[0]));
    }
  });
}
