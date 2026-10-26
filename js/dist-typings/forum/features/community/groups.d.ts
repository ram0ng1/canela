import Group from 'flarum/common/models/Group';
/**
 * Os grupos que o fórum já recebe no payload — o core só manda os que o ator
 * pode ver (os ocultos ficam de fora para quem não pode). Visitantes e
 * Membros saem: ninguém é adicionado a eles, então não há membros a listar.
 */
export declare function communityGroups(): Group[];
/**
 * O endereço leva o plural do nome, e o id quando o nome não rende um
 * endereço (vazio, só símbolos). Como o nome dos grupos do core é traduzido,
 * `findGroup` também aceita o id (que não muda nunca) e o singular.
 */
export declare function groupSlug(group: Group): string;
export declare function groupUrl(group: Group): string;
export declare function findGroup(name: string): Group | null;
export declare function memberCount(group: Group): number | null;
export declare function groupsEnabled(): boolean;
