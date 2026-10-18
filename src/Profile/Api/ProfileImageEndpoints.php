<?php

declare(strict_types=1);

namespace Ramon\Canela\Profile\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Foundation\ValidationException;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Psr\Http\Message\UploadedFileInterface;
use Ramon\Canela\Profile\ProfileImage;
use Ramon\Canela\Profile\ProfileImageUploader;
use Ramon\Canela\Profile\ProfileImageValidator;
use Ramon\Canela\Profile\ProfileSettings;

/**
 * Envio e remoção da capa e do fundo do cartão:
 *
 *   POST   /api/users/{id}/canela-cover            (multipart, campo `image`)
 *   DELETE /api/users/{id}/canela-cover
 *   POST   /api/users/{id}/canela-card-background
 *   DELETE /api/users/{id}/canela-card-background
 *
 * As rotas existem sempre (o roteador da API é montado antes de as
 * configurações serem lidas), mas com o recurso desligado respondem 404, como
 * se não existissem. Todas devolvem o usuário, que o fórum joga no store.
 */
final class ProfileImageEndpoints
{
    private const FILE_FIELD = 'image';

    public function __construct(
        private readonly ProfileSettings $settings,
        private readonly ProfileImageUploader $uploader,
        private readonly ProfileImageValidator $validator,
        private readonly TranslatorInterface $translator
    ) {
    }

    /** @return array<int, Endpoint\Endpoint> */
    public function __invoke(): array
    {
        $endpoints = [];

        foreach (ProfileImage::cases() as $kind) {
            $endpoints[] = Endpoint\Endpoint::make('canela.'.$kind->attribute().'.upload')
                ->route('POST', '/{id}/'.$kind->route())
                ->authenticated()
                ->can($this->ability(...))
                ->action(fn (Context $context) => $this->upload($context, $kind));

            $endpoints[] = Endpoint\Endpoint::make('canela.'.$kind->attribute().'.delete')
                ->route('DELETE', '/{id}/'.$kind->route())
                ->authenticated()
                ->can($this->ability(...))
                ->action(fn (Context $context) => $this->remove($context, $kind));
        }

        return $endpoints;
    }

    /**
     * A permissão é checada antes da ação; é aqui, então, que o recurso
     * desligado vira 404 — senão a política negaria antes e sairia um 403,
     * que denuncia a rota.
     */
    private function ability(): string
    {
        if (! $this->settings->fieldEnabled(ProfileSettings::COVER)) {
            throw new RouteNotFoundException();
        }

        return 'canelaEditProfile';
    }

    private function upload(Context $context, ProfileImage $kind): User
    {
        // O envio tem chave própria: o admin pode aceitar só URLs (sem
        // arquivos no disco do fórum) e manter a capa ligada.
        if (! $this->settings->coverUploadEnabled()) {
            throw new RouteNotFoundException();
        }

        $file = Arr::get($context->request->getUploadedFiles(), self::FILE_FIELD);

        if (! $file instanceof UploadedFileInterface) {
            throw new ValidationException([
                self::FILE_FIELD => str_replace(':attribute', self::FILE_FIELD, $this->translator->trans('validation.required')),
            ]);
        }

        $this->validator->assertImageValid(self::FILE_FIELD, $file);

        /** @var User $user */
        $user = $context->model;

        $this->uploader->upload($user, $kind, $file);
        $user->save();

        return $user;
    }

    private function remove(Context $context, ProfileImage $kind): User
    {
        if (! $this->settings->fieldEnabled(ProfileSettings::COVER)) {
            throw new RouteNotFoundException();
        }

        /** @var User $user */
        $user = $context->model;

        $this->uploader->remove($user, $kind);
        $user->save();

        return $user;
    }
}
