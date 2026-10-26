/*
 * As subabas de "Atividade" do perfil que faltavam: Lidos, Reações, Votos e Resolvido. Cada uma só aparece com a
 * extensão dela ligada e a chave dela no admin (card "Página de perfil"):
 *
 * - Lidos (`user.read`): os tópicos que a pessoa leu, do mais recente para o
 *   mais antigo. Pessoal: só a própria pessoa e administradores.
 * - Reações (`user.reactions`, fof/reactions): curtidas e reações que a
 *   pessoa deu, numa lista só (no Canela a curtida é a reação "coração").
 *   Ela toma o lugar de "Curtidas"; sem o fof, fica a "Curtidas" do core.
 *   As reações só aparecem para quem tem a permissão do fof de ver quem
 *   reagiu; as curtidas, para todos.
 * - Votos (`user.votes`, fof/polls): as postagens com enquetes em que votou,
 *   onde a enquete mostra os votantes (ou todas, para a própria pessoa).
 * - Resolvido (`user.solved`, fof/best-answer): as respostas dela escolhidas
 *   como melhor resposta.
 *
 * As rotas ficam em ../extend.ts (Extend.Routes); o servidor já atende
 * `/u/{username}[/{filter}]` com a página do perfil. As páginas descem em
 * chunks próprios, sob demanda.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserPage from 'flarum/forum/components/UserPage';
import LinkButton from 'flarum/common/components/LinkButton';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { forumBool, isExtensionEnabled, t } from '../../utils/settings';

/**
 * A ordem das subabas: Todos, Tópicos, Lidos, Rascunhos,
 * Curtidas, Favoritos, Reações, Votos, Resolvido. Menções e mídia vêm
 * depois; as de outras extensões, no fim.
 */
export const ACTIVITY_ORDER = [
  'posts',
  'discussions',
  'canelaRead',
  'canelaDrafts',
  'likes',
  // Curtidas + reações: no lugar das Curtidas.
  'canelaReactions',
  'canelaBookmarks',
  'canelaVotes',
  'canelaSolved',
  'mentions',
  'uploads',
];

export type Tab = 'read' | 'reactions' | 'votes' | 'solved';

export const TABS: Record<Tab, { key: string; icon: string; load: () => Promise<any> }> = {
  read: { key: 'canelaRead', icon: 'fas fa-clock-rotate-left', load: () => import('./ReadUserPage') },
  reactions: { key: 'canelaReactions', icon: 'far fa-face-smile', load: () => import('./ReactionsUserPage') },
  votes: { key: 'canelaVotes', icon: 'fas fa-check-to-slot', load: () => import('./VotesUserPage') },
  solved: { key: 'canelaSolved', icon: 'far fa-square-check', load: () => import('./SolvedUserPage') },
};

/** Lidos (e o que mais for pessoal): a própria pessoa ou quem administra. */
export function canSeePrivate(user: User): boolean {
  const actor = app.session.user;

  return !!actor && (actor === user || !!actor.isAdmin());
}

/**
 * Se a aba existe para este perfil. Lida na hora de desenhar: no initializer
 * o `app.forum` ainda não existe. Lidos e Votos dependem dos filtros do
 * recurso `activity` do servidor (`canelaActivityFilters`).
 */
export function activityTabOn(tab: Tab, user: User): boolean {
  const filters = !!app.forum.attribute('canelaActivityFilters');

  switch (tab) {
    case 'read':
      return filters && forumBool('canelaUserActivityRead', true) && canSeePrivate(user);
    case 'reactions':
      return (
        filters &&
        isExtensionEnabled('fof-reactions') &&
        forumBool('canelaUserActivityReactions', true) &&
        (isExtensionEnabled('flarum-likes') || !!app.forum.attribute('canelaCanSeeReactions'))
      );
    case 'votes':
      return filters && isExtensionEnabled('fof-polls') && forumBool('canelaUserActivityVotes', true);
    case 'solved':
      return isExtensionEnabled('fof-best-answer') && forumBool('canelaUserActivitySolved', true);
  }
}

/** A aba digitada à mão sem poder vê-la volta para as postagens. */
export function leaveIfHidden(tab: Tab, user: User): boolean {
  if (activityTabOn(tab, user)) return false;

  m.route.set(app.route('user.posts', { username: user.slug() }), undefined, { replace: true });

  return true;
}

export default function installActivity() {
  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    const user = this.user;

    if (!user) return;

    // Curtidas e reações viram uma aba só ("Reações").
    if (activityTabOn('reactions', user) && items.has('likes')) items.remove('likes');

    (Object.keys(TABS) as Tab[]).forEach((tab) => {
      if (!activityTabOn(tab, user)) return;

      items.add(
        TABS[tab].key,
        <LinkButton href={app.route(`user.${tab}`, { username: user.slug() })} icon={TABS[tab].icon}>
          {t(`user.nav.${tab}`)}
        </LinkButton>,
        // A posição final sai do ACTIVITY_ORDER, na navegação do perfil.
        60
      );
    });
  });
}
