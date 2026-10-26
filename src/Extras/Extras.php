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

namespace Ramon\Canela\Extras;

use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;

/**
 * As chaves dos recursos "extras" (busca avançada, seleção em massa, melhores
 * por período, tamanho do texto, banner, imprimir e histórico de edições).
 *
 * Num lugar só porque o extender, os controladores e o ouvinte precisam
 * concordar sobre o nome de cada uma — uma chave digitada errado num deles não
 * dá erro, só faz o recurso ligar ou desligar sem motivo aparente.
 */
final class Extras
{
    public const SEARCH_PAGE = 'canela.search_page_enabled';

    public const BULK_SELECT = 'canela.bulk_select_enabled';

    public const TOP_PERIODS = 'canela.top_periods_enabled';

    public const TEXT_SIZE = 'canela.text_size_enabled';

    public const BANNER = 'canela.banner_enabled';

    public const BANNER_TEXT = 'canela.banner_text';

    public const BANNER_ID = 'canela.banner_id';

    public const PRINT_TOPIC = 'canela.print_topic_enabled';

    public const POST_HISTORY = 'canela.post_history_enabled';

    /** Histórico à vista de todos que veem o post; desligado, só o autor e quem pode editá-lo. */
    public const POST_HISTORY_PUBLIC = 'canela.post_history_public';

    /**
     * O repositório devolve strings ("1", "0") ou o padrão booleano do
     * extender; os dois formatos precisam dar a mesma resposta.
     */
    public static function enabled(SettingsRepositoryInterface $settings, string $key): bool
    {
        return (bool) filter_var($settings->get($key), FILTER_VALIDATE_BOOLEAN);
    }

    /** Quem pode abrir o histórico de edições desta postagem. */
    public static function canSeeHistory(SettingsRepositoryInterface $settings, User $actor, Post $post): bool
    {
        if (! self::enabled($settings, self::POST_HISTORY)) {
            return false;
        }

        if (self::enabled($settings, self::POST_HISTORY_PUBLIC)) {
            return true;
        }

        return ($actor->exists && (int) $post->user_id === (int) $actor->id) || $actor->can('edit', $post);
    }
}
