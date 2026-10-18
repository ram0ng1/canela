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

use Flarum\Settings\SettingsRepositoryInterface;

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

    /**
     * O repositório devolve strings ("1", "0") ou o padrão booleano do
     * extender; os dois formatos precisam dar a mesma resposta.
     */
    public static function enabled(SettingsRepositoryInterface $settings, string $key): bool
    {
        return (bool) filter_var($settings->get($key), FILTER_VALIDATE_BOOLEAN);
    }
}
