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

namespace Ramon\Canela\Theme\Logo;

use Flarum\Admin\LogoValidator;
use Flarum\Api\Controller\UploadImageController;
use Flarum\Foundation\ValidationException;
use Flarum\Mail\EmailLogo;
use Illuminate\Support\Arr;
use Intervention\Image\Interfaces\EncodedImageInterface;
use Laminas\Diactoros\StreamFactory;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\StreamInterface;
use Psr\Http\Message\UploadedFileInterface;
use Ramon\Canela\Support\UploadedBytes;

/**
 * O upload do logo do fórum (Administração → Aparência) aceitando SVG.
 *
 * O core converte todo logo em WebP de 60px de altura com o Intervention, que
 * não lê SVG. Aqui o SVG passa direto — vetor fica nítido em qualquer
 * tamanho —, depois de limpo ({@see SvgSanitizer}): o arquivo é servido do
 * próprio domínio, e um SVG com script aberto direto no navegador rodaria
 * com os cookies do fórum.
 *
 * Os outros formatos seguem o caminho do UploadLogoController do core,
 * reproduzido aqui: o `makeImage` dele declara só imagem codificada como
 * retorno, e o SVG volta como stream.
 */
final class SvgLogoUploadController extends UploadImageController
{
    /** O mesmo teto que o core usa para imagens do admin. */
    private const MAX_BYTES = 2 * 1024 * 1024;

    protected string $filePathSettingKey = 'logo_path';
    protected string $filenamePrefix = 'logo';
    protected ?string $validator = LogoValidator::class;

    private bool $svg = false;
    private string $resolvedExtension = 'webp';

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $file = Arr::get($request->getUploadedFiles(), 'logo');
        $this->svg = $file instanceof UploadedFileInterface && self::isSvg($file);

        // O validador do core recusa image/svg+xml; o SVG tem a própria
        // checagem em makeImage().
        if ($this->svg) {
            $this->validator = null;
        }

        return parent::handle($request);
    }

    #[\Override]
    protected function makeImage(UploadedFileInterface $file): EncodedImageInterface|StreamInterface
    {
        if (! $this->svg) {
            // Como o core: 60px de altura, GIF animado preservado, o resto WebP.
            $image = $this->imageManager->read(UploadedBytes::of($file))->scale(height: 60);

            if ($image->isAnimated()) {
                $this->resolvedExtension = 'gif';

                return $image->toGif();
            }

            $this->resolvedExtension = 'webp';

            return $image->toWebp();
        }

        if (($file->getSize() ?? 0) > self::MAX_BYTES) {
            throw new ValidationException(['logo' => 'O SVG passa de 2 MB.']);
        }

        $clean = SvgSanitizer::sanitize((string) $file->getStream());

        if ($clean === null) {
            throw new ValidationException(['logo' => 'Este arquivo não é um SVG válido.']);
        }

        return (new StreamFactory())->createStream($clean);
    }

    /**
     * A cópia do logo para os e-mails, como o core faz. Ela passa pelo
     * Intervention, que não lê SVG: com SVG, os e-mails ficam com o logo de
     * e-mail próprio, se houver.
     */
    #[\Override]
    protected function afterStore(ServerRequestInterface $request, UploadedFileInterface $file): void
    {
        if (! $this->svg) {
            $this->container->make(EmailLogo::class)->storeCopy($file->getStream()->getMetadata('uri'));
        }
    }

    #[\Override]
    protected function fileExtension(ServerRequestInterface $request, UploadedFileInterface $file): string
    {
        return $this->svg ? 'svg' : $this->resolvedExtension;
    }

    private static function isSvg(UploadedFileInterface $file): bool
    {
        $name = strtolower((string) $file->getClientFilename());

        return str_ends_with($name, '.svg') || $file->getClientMediaType() === 'image/svg+xml';
    }
}
