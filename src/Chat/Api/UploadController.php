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

namespace Ramon\Canela\Chat\Api;

use Carbon\Carbon;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatPresenter;
use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\ChatSettings;
use Ramon\Canela\Chat\Model\Upload;
use Ramon\Canela\Chat\Upload\ChatUploadValidator;
use Ramon\Canela\Chat\Upload\ChatUploads;

/**
 * `POST /api/chat/uploads` (multipart, campo `file`): envia uma imagem do
 * composer. Ela fica solta até a mensagem ser enviada com o id dela.
 *
 * Um teto de envios por hora barra quem tentar usar o chat como hospedagem de
 * imagens: o agendador apaga os soltos, mas não antes de um dia.
 */
final class UploadController extends AbstractChatController
{
    private const PER_HOUR = 60;

    public function __construct(
        ChatAccess $access,
        ChatService $service,
        ChatPresenter $presenter,
        private readonly ChatUploads $uploads,
        private readonly ChatUploadValidator $validator,
    ) {
        parent::__construct($access, $service, $presenter);
    }

    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array
    {
        if (! $this->access->settings()->bool(ChatSettings::UPLOADS_ENABLED) || $this->access->isSuspended($actor)) {
            throw new PermissionDeniedException();
        }

        if (Upload::query()->where('user_id', $actor->id)->where('created_at', '>', Carbon::now()->subHour())->count() >= self::PER_HOUR) {
            throw new PermissionDeniedException();
        }

        $file = $request->getUploadedFiles()['file'] ?? null;

        if (! $file instanceof UploadedFileInterface) {
            throw new \Flarum\Foundation\ValidationException(['file' => 'required']);
        }

        $this->validator->assertImageValid('file', $file);

        return ['upload' => $this->uploads->present($this->uploads->store($actor, $file))];
    }
}
