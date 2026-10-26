import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import { type ProfileStatus } from './data';
/** Emoji padrão de quem pôs só a frase. */
export declare const DEFAULT_STATUS_EMOJI = "\uD83D\uDCAC";
/** "até 15:30" no mesmo dia, "até sex., 18 out." depois. */
export declare function statusUntilLabel(until: Date): string;
/** Texto inteiro do status, para o title e o leitor de tela. */
export declare function statusLabel(status: ProfileStatus): string;
/** O emoji do status ao lado do nome (posts, cabeçalho, cartão). */
export declare function StatusEmoji(user: User, className?: string): Mithril.Children;
/** Linha do status no cartão: emoji, frase e até quando. */
export declare function StatusLine(user: User): Mithril.Children;
export declare function TitleLine(user: User): Mithril.Children;
export declare function Bio(user: User): Mithril.Children;
export declare function LocationFact(user: User): Mithril.Children;
export declare function WebsiteFact(user: User): Mithril.Children;
export declare function BirthdayFact(user: User): Mithril.Children;
/**
 * Variáveis CSS das imagens, para pôr no `style` do elemento do perfil ou do
 * cartão. `--canela-cover` é a que o hero do perfil já lê como camada de cima
 * da capa; `--canela-user-cover` e `--canela-user-card-bg` ficam para quem
 * quiser usar só uma delas.
 */
export declare function profileImageStyle(user: User): Record<string, string>;
/**
 * Tudo junto, na ordem do cartão de usuário: status, título, bio
 * e a linha de local/site/aniversário. Para o cartão do tópico, que é um
 * componente próprio e não um UserCard.
 */
export declare function ProfileCardExtras(user: User): Mithril.Children;
