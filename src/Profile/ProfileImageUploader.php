<?php

declare(strict_types=1);

namespace Ramon\Canela\Profile;

use Flarum\User\User;
use Illuminate\Contracts\Filesystem\Cloud;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Support\Str;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;
use Psr\Http\Message\UploadedFileInterface;

/**
 * Grava a capa e o fundo do cartão no disco `canela-covers`
 * (public/assets/canela-covers), no molde do AvatarUploader do core.
 *
 * A coluna guarda o nome do arquivo quando a imagem foi enviada, ou a URL
 * inteira quando o usuário colou um endereço: um `://` separa os dois casos,
 * como o core faz com o avatar.
 */
final class ProfileImageUploader
{
    public const DISK = 'canela-covers';

    private const WEBP_QUALITY = 82;

    private ?Cloud $disk = null;

    /*
     * O disco é resolvido só no primeiro uso, nunca no construtor: esta classe
     * entra nos campos do UserResource, que o core monta no boot (rotas da
     * API), e a configuração do disco pede o UrlGenerator — que por sua vez
     * monta as rotas. Resolver aqui fechava o ciclo e estourava a memória.
     */
    public function __construct(
        private readonly Factory $filesystems,
        private readonly ImageManager $images
    ) {
    }

    private function disk(): Cloud
    {
        return $this->disk ??= $this->filesystems->disk(self::DISK);
    }

    public function upload(User $user, ProfileImage $kind, UploadedFileInterface $file): void
    {
        $image = $this->images->read($file->getStream()->getMetadata('uri'));

        // GIF animado vira o primeiro quadro: uma capa em movimento atrás do
        // nome e do avatar só atrapalha a leitura, e o GIF de 2000px pesaria
        // vários megas a cada visita ao perfil.
        if ($image->isAnimated()) {
            $image->removeAnimation(0);
        }

        [$width, $height] = $kind->bounds();
        $image->scaleDown($width, $height);

        $path = $kind->value.'-'.Str::random(24).'.webp';
        $this->disk()->put($path, (string) $image->encode(new WebpEncoder(self::WEBP_QUALITY, true)));

        $this->replace($user, $kind, $path);
    }

    /** Uma URL externa colada pelo usuário (já validada pela API). */
    public function setExternal(User $user, ProfileImage $kind, ?string $url): void
    {
        $this->replace($user, $kind, $url);
    }

    public function remove(User $user, ProfileImage $kind): void
    {
        $this->replace($user, $kind, null);
    }

    /** A URL pública do que estiver guardado na coluna. */
    public function url(?string $stored): ?string
    {
        if ($stored === null || $stored === '') {
            return null;
        }

        return self::isExternal($stored) ? $stored : $this->disk()->url($stored);
    }

    public function deleteFile(?string $stored): void
    {
        if ($stored === null || $stored === '' || self::isExternal($stored)) {
            return;
        }

        if ($this->disk()->exists($stored)) {
            $this->disk()->delete($stored);
        }
    }

    public static function isExternal(string $stored): bool
    {
        return str_contains($stored, '://');
    }

    /**
     * Troca o valor e apaga o arquivo antigo só depois de salvar: se o save
     * falhar, o usuário continua com a imagem que tinha.
     */
    private function replace(User $user, ProfileImage $kind, ?string $value): void
    {
        $column = $kind->column();
        $previous = $user->getRawOriginal($column);

        $user->setAttribute($column, $value);

        if (is_string($previous) && $previous !== '' && $previous !== $value && ! self::isExternal($previous)) {
            $user->afterSave(fn () => $this->deleteFile($previous));
        }
    }
}
