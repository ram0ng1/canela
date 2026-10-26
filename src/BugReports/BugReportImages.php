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

namespace Ramon\Canela\BugReports;

use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Str;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;

/**
 * As capturas de tela dos relatórios.
 *
 * Ficam num disco privado (storage/, fora de public/): uma captura pode
 * mostrar o que só aquela pessoa vê, então só sai pelo controlador, para o
 * admin ou para quem reportou. Toda imagem é relida e regravada em WebP: o
 * que chega do navegador nunca vai para o disco como veio.
 */
final class BugReportImages
{
    public const DISK = 'canela-bug-reports';

    /** O maior arquivo aceito, já decodificado do base64. */
    public const MAX_BYTES = 6 * 1024 * 1024;

    /** O maior lado aceito, em pixels (uma tela 4K com densidade 2). */
    public const MAX_SIDE = 8000;

    private const WEBP_QUALITY = 90;

    private ?Filesystem $disk = null;

    public function __construct(
        private readonly Factory $filesystems,
        private readonly ImageManager $images,
    ) {
    }

    private function disk(): Filesystem
    {
        return $this->disk ??= $this->filesystems->disk(self::DISK);
    }

    /**
     * Os bytes de um `data:image/png|jpeg|webp;base64,…`, ou null se não for
     * uma imagem nesse formato ou passar do tamanho.
     */
    public static function decodeDataUrl(mixed $value): ?string
    {
        if (! is_string($value) || ! preg_match('#^data:image/(png|jpeg|webp);base64,#', $value, $match)) {
            return null;
        }

        $payload = substr($value, strlen($match[0]));

        // O base64 cresce 4/3: corta antes de decodificar algo grande demais.
        if ($payload === '' || strlen($payload) > (int) ceil(self::MAX_BYTES * 4 / 3) + 4) {
            return null;
        }

        $bytes = base64_decode($payload, true);

        return $bytes === false || $bytes === '' || strlen($bytes) > self::MAX_BYTES ? null : $bytes;
    }

    /** Grava a imagem e devolve o caminho no disco; null se não for uma imagem válida. */
    public function store(string $bytes): ?string
    {
        try {
            $image = $this->images->read($bytes);
        } catch (\Throwable) {
            return null;
        }

        if ($image->width() < 1 || $image->height() < 1 || $image->width() > self::MAX_SIDE || $image->height() > self::MAX_SIDE) {
            return null;
        }

        $path = date('Y/m').'/'.Str::random(32).'.webp';
        $this->disk()->put($path, (string) $image->encode(new WebpEncoder(self::WEBP_QUALITY, true)));

        return $path;
    }

    public function read(?string $path): ?string
    {
        if (! $path || ! $this->disk()->exists($path)) {
            return null;
        }

        return $this->disk()->get($path);
    }

    public function delete(?string $path): void
    {
        if ($path && $this->disk()->exists($path)) {
            $this->disk()->delete($path);
        }
    }
}
