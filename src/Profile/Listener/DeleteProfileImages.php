<?php

declare(strict_types=1);

namespace Ramon\Canela\Profile\Listener;

use Flarum\User\Event\Deleted;
use Ramon\Canela\Profile\ProfileImage;
use Ramon\Canela\Profile\ProfileImageUploader;

/**
 * Conta apagada leva junto a capa e o fundo do cartão enviados: senão os
 * arquivos ficariam em public/assets para sempre, acessíveis por quem tivesse
 * guardado o link.
 */
final class DeleteProfileImages
{
    public function __construct(
        private readonly ProfileImageUploader $uploader
    ) {
    }

    public function handle(Deleted $event): void
    {
        foreach (ProfileImage::cases() as $kind) {
            $stored = $event->user->getRawOriginal($kind->column());

            $this->uploader->deleteFile(is_string($stored) ? $stored : null);
        }
    }
}
