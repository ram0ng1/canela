/*
 * Grupos nas páginas de comunidade: quais aparecem, o endereço de cada um
 * (/g/:nome) e o caminho de volta do nome para o grupo.
 */
import app from 'flarum/forum/app';
import Group from 'flarum/common/models/Group';
import { slug } from 'flarum/common/utils/string';

import { forumBool } from '../../utils/settings';

/**
 * Os grupos que o fórum já recebe no payload — o core só manda os que o ator
 * pode ver (os ocultos ficam de fora para quem não pode). Visitantes e
 * Membros saem: ninguém é adicionado a eles, então não há membros a listar.
 */
export function communityGroups(): Group[] {
  return app.store
    .all<Group>('groups')
    .filter((group) => group.id() !== Group.GUEST_ID && group.id() !== Group.MEMBER_ID)
    .sort((a, b) => {
      // Administradores e moderadores primeiro, como na lista do Discourse;
      // depois a ordem do admin (posição) e o nome.
      const rank = (group: Group) => (group.id() === Group.ADMINISTRATOR_ID ? 0 : group.id() === '4' ? 1 : 2);
      const position = (group: Group) => group.attribute<number | null>('position') ?? Number.MAX_SAFE_INTEGER;

      return rank(a) - rank(b) || position(a) - position(b) || (a.namePlural() || '').localeCompare(b.namePlural() || '');
    });
}

/** "Moderadores" → "moderadores": o nome sem acento, como o Discourse usa no endereço. */
function nameSlug(name: string | undefined): string {
  return slug((name || '').normalize('NFD').replace(/[̀-ͯ]/g, ''));
}

/**
 * O endereço leva o plural do nome, e o id quando o nome não rende um
 * endereço (vazio, só símbolos). Como o nome dos grupos do core é traduzido,
 * `findGroup` também aceita o id (que não muda nunca) e o singular.
 */
export function groupSlug(group: Group): string {
  return nameSlug(group.namePlural()) || group.id()!;
}

export function groupUrl(group: Group): string {
  return app.route('canela.group', { name: groupSlug(group) });
}

export function findGroup(name: string): Group | null {
  const wanted = decodeURIComponent(name || '').toLowerCase();
  const groups = communityGroups();

  return (
    groups.find((group) => groupSlug(group) === wanted) ||
    groups.find((group) => group.id() === wanted) ||
    groups.find((group) => nameSlug(group.nameSingular()) === wanted) ||
    null
  );
}

export function memberCount(group: Group): number | null {
  const count = group.attribute<number | undefined>('canelaMemberCount');

  return typeof count === 'number' ? count : null;
}

export function groupsEnabled(): boolean {
  return forumBool('canelaGroupsEnabled', true);
}
