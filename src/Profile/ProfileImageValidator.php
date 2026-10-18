<?php

declare(strict_types=1);

namespace Ramon\Canela\Profile;

use Flarum\Foundation\AbstractImageValidator;

/**
 * Mesma validação do avatar (tipo pelo MIME, extensões PHP barradas, teto de
 * pixels contra "bombas" de descompressão, decodificação de verdade), com um
 * limite de bytes maior: uma capa é uma foto larga, não um quadrado de 100px.
 */
final class ProfileImageValidator extends AbstractImageValidator
{
    /** Em KB, como o core mede. */
    public const MAX_SIZE_KB = 4096;

    #[\Override]
    public function getMaxSize(): int
    {
        return self::MAX_SIZE_KB;
    }

    /** Sem BMP: o arquivo é enorme e nenhum navegador precisa dele numa capa. */
    #[\Override]
    protected function getAllowedTypes(): array
    {
        return ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    }
}
