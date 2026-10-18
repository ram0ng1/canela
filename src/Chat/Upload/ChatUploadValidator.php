<?php

declare(strict_types=1);

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Chat\Upload;

use Flarum\Foundation\AbstractImageValidator;
use Ramon\Canela\Chat\ChatSettings;

/**
 * A validação das imagens do chat: a mesma do avatar e da capa do perfil
 * (tipo pelo MIME, extensões PHP barradas, teto de pixels contra "bombas" de
 * descompressão, decodificação de verdade), com o limite de tamanho do admin.
 */
final class ChatUploadValidator extends AbstractImageValidator
{
    #[\Override]
    public function getMaxSize(): int
    {
        return ChatSettings::make()->uploadMaxKb();
    }

    #[\Override]
    protected function getAllowedTypes(): array
    {
        return ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    }
}
