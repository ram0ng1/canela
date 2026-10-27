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
use Flarum\Foundation\ValidationException;
use Flarum\Http\RequestUtil;
use Flarum\User\Exception\PermissionDeniedException;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\UploadedFileInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatSettings;
use Ramon\Canela\Chat\Model\Upload;
use Ramon\Canela\Chat\Upload\ChatUploadValidator;
use Ramon\Canela\Chat\Upload\ChatUploads;

/**
 * `POST /api/chat/uploads` (multipart, campo `file`): envia uma imagem do
 * composer. Ela fica solta até a mensagem ser enviada com o id dela.
 *
 * Continua um controller, como o do fof/upload: o corpo é multipart, não um
 * documento JSON:API. A imagem passa pelo ChatUploadValidator (tipo, tamanho
 * do admin, resolução); a resposta é o anexo, no formato do `uploads` das
 * mensagens.
 *
 * Um teto de envios por hora barra quem tentar usar o chat como hospedagem de
 * imagens: o agendador apaga os soltos, mas não antes de um dia.
 */
final class UploadController implements RequestHandlerInterface
{
    private const PER_HOUR = 60;

    public function __construct(
        private readonly ChatAccess $access,
        private readonly ChatUploads $uploads,
        private readonly ChatUploadValidator $validator,
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->access->settings()->assertEnabled();

        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();
        $this->access->assertCanUse($actor);

        if (! $this->access->settings()->bool(ChatSettings::UPLOADS_ENABLED) || $this->access->isSuspended($actor)) {
            throw new PermissionDeniedException();
        }

        if (Upload::query()->where('user_id', $actor->id)->where('created_at', '>', Carbon::now()->subHour())->count() >= self::PER_HOUR) {
            throw new PermissionDeniedException();
        }

        $file = $request->getUploadedFiles()['file'] ?? null;

        // O validador de imagem do core pede um arquivo; sem nenhum, o erro
        // é o mesmo "obrigatório" no campo `file`.
        if (! $file instanceof UploadedFileInterface) {
            throw new ValidationException(['file' => 'required']);
        }

        $this->validator->assertImageValid('file', $file);

        return new JsonResponse(['upload' => $this->uploads->present($this->uploads->store($actor, $file))]);
    }
}
