import type Mithril from 'mithril';
import type { IconNode } from 'lucide';
/**
 * O desenho Lucide de uma classe do Font Awesome, ou `null` se ela continua no
 * Font Awesome (fora do mapa, ou a opção desligada no admin).
 */
export declare function lucideFor(classes: string): {
    name: string;
    node: IconNode;
} | null;
/**
 * Os elementos internos de um desenho, para quem monta o próprio <svg> (os
 * ícones fixos da casca e do menu do usuário, que são Lucide sempre).
 */
export declare function lucideChildren(name: string): Mithril.Children;
/**
 * Para os poucos lugares que montam HTML como texto (`innerHTML` em conteúdo
 * renderizado do post): a mesma regra do componente, em string.
 */
export declare function iconMarkup(classes: string, extraClass?: string): string;
export default function installIcons(): void;
