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

use Carbon\Carbon;
use Flarum\User\User;
use Illuminate\Contracts\Filesystem\Cloud;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;
use Psr\Http\Message\UploadedFileInterface;
use Ramon\Canela\Chat\Model\Upload;
use Ramon\Canela\Support\Log;
use Ramon\Canela\Support\UploadedBytes;

/**
 * As imagens do chat, no disco `canela-chat` (public/assets/canela-chat).
 *
 * O arquivo vai como foi enviado — um GIF animado continua animado —, depois
 * de o ChatUploadValidator decodificá-lo de verdade (o
 * mesmo AbstractImageValidator do avatar). Só a medida é lida, para a
 * miniatura reservar o espaço certo e a conversa não pular ao carregar.
 */
final class ChatUploads
{
    public const DISK = 'canela-chat';

    private ?Cloud $disk = null;

    /*
     * O disco é resolvido só no primeiro uso: a configuração dele pede o
     * UrlGenerator, que monta as rotas — no construtor, isso podia fechar um
     * ciclo no boot (o mesmo achado do recurso de perfil).
     */
    public function __construct(
        private readonly Factory $filesystems,
        private readonly ImageManager $images,
    ) {
    }

    private function disk(): Cloud
    {
        return $this->disk ??= $this->filesystems->disk(self::DISK);
    }

    public function store(User $actor, UploadedFileInterface $file): Upload
    {
        // Pelo fluxo do PSR-7, não pelo caminho do arquivo temporário, e o
        // tipo sai do conteúdo.
        $bytes = UploadedBytes::of($file);
        $image = $this->images->read($bytes);
        $mime = UploadedBytes::mime($bytes) ?? ($file->getClientMediaType() ?: 'image/png');

        $extension = match ($mime) {
            'image/jpeg' => 'jpg',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            default => 'png',
        };

        $path = date('Y/m').'/'.Str::random(32).'.'.$extension;
        $this->disk()->put($path, $bytes);

        $upload = new Upload();
        $upload->user_id = $actor->id;
        $upload->path = $path;
        $upload->original_name = mb_substr(basename((string) ($file->getClientFilename() ?: 'image.'.$extension)), 0, 255);
        $upload->mime = $mime;
        $upload->size = (int) $file->getSize();
        $upload->width = min(65535, $image->width());
        $upload->height = min(65535, $image->height());
        $upload->created_at = Carbon::now();
        $upload->save();

        return $upload;
    }

    public function url(Upload $upload): string
    {
        return $this->disk()->url($upload->path);
    }

    public function deleteFile(Upload $upload): void
    {
        try {
            if ($this->disk()->exists($upload->path)) {
                $this->disk()->delete($upload->path);
            }
        } catch (\Throwable $error) {
            Log::warning('chat: não deu para apagar '.$upload->path.': '.$error->getMessage());
        }
    }

    /** @return array<string, mixed> */
    public function present(Upload $upload): array
    {
        return [
            'id' => $upload->id,
            'url' => $this->url($upload),
            'name' => $upload->original_name,
            'mime' => $upload->mime,
            'size' => $upload->size,
            'width' => $upload->width,
            'height' => $upload->height,
        ];
    }
}
