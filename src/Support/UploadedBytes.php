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

namespace Ramon\Canela\Support;

use Psr\Http\Message\UploadedFileInterface;

/**
 * O conteúdo de um arquivo enviado, lido pelo fluxo do PSR-7. Ler pelo
 * caminho do arquivo temporário (`getMetadata('uri')`) só funciona quando o
 * fluxo é um arquivo em disco; o fluxo vale para qualquer origem.
 */
final class UploadedBytes
{
    public static function of(UploadedFileInterface $file): string
    {
        $stream = $file->getStream();

        if ($stream->isSeekable()) {
            $stream->rewind();
        }

        $bytes = $stream->getContents();

        if ($stream->isSeekable()) {
            $stream->rewind();
        }

        return $bytes;
    }

    /** O tipo MIME tirado do conteúdo, não do nome do arquivo nem do que o navegador disse. */
    public static function mime(string $bytes): ?string
    {
        if ($bytes === '') {
            return null;
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);

        return is_string($mime) && $mime !== '' ? $mime : null;
    }
}
