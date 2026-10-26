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

namespace Ramon\Canela\Backgrounds\Api;

use Flarum\Admin\LogoValidator;
use Flarum\Api\Controller\UploadImageController;
use Flarum\Http\Exception\RouteNotFoundException;
use Intervention\Image\Interfaces\EncodedImageInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\StreamInterface;
use Psr\Http\Message\UploadedFileInterface;
use Ramon\Canela\Backgrounds\Backgrounds;
use Ramon\Canela\Support\UploadedBytes;

/**
 * `POST /api/canela/backgrounds/{target}` (forum ou auth): a imagem de fundo
 * enviada no admin. Segue o upload do logo do core: só administrador, a
 * validação de imagem do admin, o arquivo no disco de assets e o nome dele
 * na configuração. Vira WebP de até 2560 × 1600 (um fundo maior que isso só
 * pesa) e perde a animação de um GIF.
 */
final class UploadBackgroundController extends UploadImageController
{
    /** O campo do formulário: o mesmo nome para os dois fundos. */
    public const FIELD = 'background';

    private const MAX_WIDTH = 2560;
    private const MAX_HEIGHT = 1600;
    private const QUALITY = 80;

    protected ?string $validator = LogoValidator::class;

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        self::target($request);

        return parent::handle($request);
    }

    #[\Override]
    protected function makeImage(UploadedFileInterface $file): EncodedImageInterface|StreamInterface
    {
        $image = $this->imageManager->read(UploadedBytes::of($file));

        if ($image->isAnimated()) {
            $image->removeAnimation(0);
        }

        return $image->scaleDown(self::MAX_WIDTH, self::MAX_HEIGHT)->toWebp(self::QUALITY);
    }

    #[\Override]
    protected function filePathSettingKey(ServerRequestInterface $request, UploadedFileInterface $file): string
    {
        return Backgrounds::imageKey(self::target($request));
    }

    #[\Override]
    protected function filenamePrefix(ServerRequestInterface $request): string
    {
        return self::FIELD;
    }

    public static function target(ServerRequestInterface $request): string
    {
        $params = $request->getAttribute('routeParameters');
        $target = is_array($params) ? ($params['target'] ?? null) : null;

        if (! is_string($target) || ! in_array($target, Backgrounds::TARGETS, true)) {
            throw new RouteNotFoundException();
        }

        return $target;
    }
}
