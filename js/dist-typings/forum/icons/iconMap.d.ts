/**
 * Apelidos antigos do Font Awesome → nome canônico do FA 6 (o das chaves do
 * mapa). Só os que aparecem no core, nas extensões instaladas ou no tema, mais
 * os mais comuns que um admin digita para tags e grupos.
 */
export declare const FA_ALIASES: Record<string, string>;
/**
 * A tabela principal (nome do Font Awesome → nome do Lucide). As chaves `far-*` são as variantes regulares.
 */
export declare const META_MAP: Record<string, string>;
/**
 * Os que ficam fora do mapa de propósito (`square-full` e `circle`). O
 * `circle` sólido fica no
 * Font Awesome porque é usado como bolinha cheia (status, não lido). O
 * coração cheio de quem curtiu não tem nome no Flarum: o tema o reproduz preenchendo o coração do Lucide pelo CSS (Icons.less).
 */
export declare const META_IGNORED: Set<string>;
/**
 * Ícones de interface que o Flarum e as extensões usam e que a tabela
 * principal não cobre. Sem eles, a casca misturaria traço
 * e sólido na mesma barra; o equivalente escolhido é o do próprio Lucide.
 */
export declare const CANELA_EXTRAS: Record<string, string>;
/**
 * O nome do Lucide para uma classe de ícone do Flarum (`fas fa-search`,
 * `far fa-bell fa-fw`…), ou `null` quando o ícone deve continuar no Font
 * Awesome: marcas (`fab`), os ignorados (META_IGNORED) e qualquer um fora do mapa,
 * como boa parte dos que o admin escolhe para tags e grupos.
 */
export declare function lucideNameFor(classes: string): string | null;
