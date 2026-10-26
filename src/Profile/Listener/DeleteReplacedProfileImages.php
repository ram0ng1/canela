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

namespace Ramon\Canela\Profile\Listener;

use Flarum\User\User;
use Ramon\Canela\Profile\ProfileImage;
use Ramon\Canela\Profile\ProfileImageUploader;

/**
 * Coluna da capa ou do fundo do cartão trocada por qualquer caminho — não só
 * pela API do tema — leva junto o arquivo enviado que ela apontava.
 *
 * O caso que importa é a anonimização do flarum/gdpr: o tipo de dados User
 * dele zera todas as colunas da tabela `users` e salva, e os arquivos ficavam
 * em public/assets/canela-covers, acessíveis por quem tivesse o link. Como
 * isto ouve o `saved` do próprio modelo, vale também sem o flarum/gdpr
 * instalado (e sem depender da ordem dos tipos de dados dele).
 *
 * Roda no `saved`, antes de o Eloquent sincronizar o original: o valor
 * anterior ainda está em getRawOriginal(). Só depois de gravar — se o save
 * falhar, o arquivo continua lá.
 */
final class DeleteReplacedProfileImages
{
    public function __construct(
        private readonly ProfileImageUploader $uploader
    ) {
    }

    public function handle(User $user): void
    {
        foreach (ProfileImage::cases() as $kind) {
            $column = $kind->column();

            if (! $user->wasChanged($column)) {
                continue;
            }

            $previous = $user->getRawOriginal($column);

            if (is_string($previous) && $previous !== $user->getAttribute($column)) {
                $this->uploader->deleteFile($previous);
            }
        }
    }
}
