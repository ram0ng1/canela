import type User from 'flarum/common/models/User';
/**
 * A ordem das subabas: Todos, Tópicos, Lidos, Rascunhos,
 * Curtidas, Favoritos, Reações, Votos, Resolvido. Menções e mídia vêm
 * depois; as de outras extensões, no fim.
 */
export declare const ACTIVITY_ORDER: string[];
type Tab = 'read' | 'reactions' | 'votes' | 'solved';
/** Lidos (e o que mais for pessoal): a própria pessoa ou quem administra. */
export declare function canSeePrivate(user: User): boolean;
/**
 * Se a aba existe para este perfil. Lida na hora de desenhar: no initializer
 * o `app.forum` ainda não existe. Lidos e Votos dependem dos filtros do
 * recurso `activity` do servidor (`canelaActivityFilters`).
 */
export declare function activityTabOn(tab: Tab, user: User): boolean;
/** A aba digitada à mão sem poder vê-la volta para as postagens. */
export declare function leaveIfHidden(tab: Tab, user: User): boolean;
export default function installActivity(): void;
export {};
