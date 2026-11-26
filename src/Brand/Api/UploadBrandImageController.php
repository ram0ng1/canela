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

namespace Ramon\Canela\Brand\Api;

use Flarum\Admin\LogoValidator;
use Flarum\Api\Controller\UploadImageController;
use Flarum\Http\Exception\RouteNotFoundException;
use Intervention\Image\Interfaces\EncodedImageInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\StreamInterface;
use Psr\Http\Message\UploadedFileInterface;
use Ramon\Canela\Brand\Brand;
use Ramon\Canela\Support\UploadedBytes;

/**
 * `POST /api/canela/brand/{area}`: a imagem que o admin envia no lugar da
 * arte gerada de uma área (Brand::AREAS). O mesmo caminho do fundo enviado
 * (UploadBackgroundController): só administrador, a validação do logo do core,
 * WebP no disco de assets. Uma ilustração não passa de 1600 px; a
 * transparência fica (o WebP guarda o alfa).
 */
final class UploadBrandImageController extends UploadImageController
{
    public const FIELD = 'brand';

    private const MAX_SIZE = 1600;
    private const QUALITY = 85;

    protected ?string $validator = LogoValidator::class;

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        self::area($request);

        return parent::handle($request);
    }

    #[\Override]
    protected function makeImage(UploadedFileInterface $file): EncodedImageInterface|StreamInterface
    {
        $image = $this->imageManager->read(UploadedBytes::of($file));

        if ($image->isAnimated()) {
            $image->removeAnimation(0);
        }

        return $image->scaleDown(self::MAX_SIZE, self::MAX_SIZE)->toWebp(self::QUALITY);
    }

    #[\Override]
    protected function filePathSettingKey(ServerRequestInterface $request, UploadedFileInterface $file): string
    {
        return Brand::imageKey(self::area($request));
    }

    #[\Override]
    protected function filenamePrefix(ServerRequestInterface $request): string
    {
        return self::FIELD;
    }

    public static function area(ServerRequestInterface $request): string
    {
        $params = $request->getAttribute('routeParameters');
        $area = is_array($params) ? ($params['area'] ?? null) : null;

        if (! is_string($area) || ! in_array($area, Brand::AREAS, true)) {
            throw new RouteNotFoundException();
        }

        return $area;
    }
}
