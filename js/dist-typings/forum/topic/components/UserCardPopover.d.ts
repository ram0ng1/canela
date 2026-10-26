import type User from 'flarum/common/models/User';
/**
 * O perfil completo e os emblemas, uma vez por sessão para cada pessoa. O
 * usuário que vem junto do post não traz as estatísticas (só a resposta do
 * perfil traz), e os emblemas vêm de outro pedido.
 */
export declare function prefetchUserCard(user: User): Promise<unknown>;
export declare function openUserCard(user: User, anchor: HTMLElement): void;
export declare function closeUserCard(): void;
