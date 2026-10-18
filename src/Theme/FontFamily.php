<?php

declare(strict_types=1);

namespace Ramon\Canela\Theme;

/**
 * Família tipográfica do tema, entregue ao LESS como `@config-canela-font`.
 *
 * O LESS escolhe a pilha de fontes casando o identificador num mixin
 * (less/common/tokens.less), por isso só identificadores conhecidos passam.
 */
final class FontFamily
{
    public const SETTING = 'canela.font';

    public const INTER = 'inter';

    public const JAKARTA = 'jakarta';

    public const SYSTEM = 'system';

    private const KNOWN_FAMILIES = [self::INTER, self::JAKARTA, self::SYSTEM];

    public function __invoke(mixed $value): string
    {
        return in_array($value, self::KNOWN_FAMILIES, true) ? $value : self::INTER;
    }
}
