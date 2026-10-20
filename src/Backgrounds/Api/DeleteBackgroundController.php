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

use Flarum\Api\Controller\AbstractDeleteController;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Filesystem\Factory;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Backgrounds\Backgrounds;

/** `DELETE /api/canela/backgrounds/{target}`: tira a imagem de fundo enviada. */
final class DeleteBackgroundController extends AbstractDeleteController
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly Factory $filesystems,
    ) {
    }

    #[\Override]
    protected function delete(ServerRequestInterface $request): void
    {
        RequestUtil::getActor($request)->assertAdmin();

        $key = Backgrounds::imageKey(UploadBackgroundController::target($request));
        $path = $this->settings->get($key);

        $this->settings->set($key, null);

        $disk = $this->filesystems->disk('flarum-assets');

        if (is_string($path) && $path !== '' && $disk->exists($path)) {
            $disk->delete($path);
        }
    }
}
