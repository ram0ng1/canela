import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import type Badge from '../models/Badge';
export interface BadgeCardAttrs extends ComponentAttrs {
    className?: string;
    badge: Badge;
    /** Na aba do perfil: de quem é, para o link levar à página com a pessoa em destaque. */
    username?: string;
    /** Quantas vezes a pessoa ganhou (emblemas de concessão múltipla). */
    timesGranted?: number;
    grantedAt?: Date | null;
    /** A pessoa logada tem o emblema (a marca da página /badges). */
    owned?: boolean;
    /** Mostra o "N concedidos" (a página /badges). */
    showCount?: boolean;
}
/**
 * Um emblema em cartão: o ícone grande na
 * cor do tipo (ouro, prata, bronze) à esquerda e, ao lado, o nome, a
 * descrição e, conforme o lugar, quantas pessoas o ganharam ou quando a
 * pessoa do perfil o ganhou. O cartão inteiro é o link.
 */
export default class BadgeCard extends Component<BadgeCardAttrs> {
    view(): JSX.Element;
    footer(showCount?: boolean, grantedAt?: Date | null): Mithril.Children;
}
