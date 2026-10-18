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

namespace Ramon\Canela\Bookmarks;

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * Liga/desliga dos marcadores (`canela.bookmarks_enabled`).
 *
 * O recurso continua registrado com a opção desligada — as rotas da API são
 * montadas uma vez no boot, sem acesso às configurações — e cada ponto de
 * entrada pergunta aqui. Desligado, a API responde 404, como se o recurso não
 * existisse, e os atributos dos posts somem.
 */
final class BookmarksFeature
{
    public const ENABLED = 'canela.bookmarks_enabled';

    public const TOPIC_BUTTON = 'canela.bookmarks_topic_button';

    public const USER_MENU = 'canela.bookmarks_user_menu';

    public static function enabled(): bool
    {
        /** @var SettingsRepositoryInterface $settings */
        $settings = resolve(SettingsRepositoryInterface::class);

        return (bool) $settings->get(self::ENABLED, true);
    }

    /**
     * @throws ModelNotFoundException
     */
    public static function assertEnabled(): void
    {
        if (! self::enabled()) {
            throw new ModelNotFoundException();
        }
    }
}
