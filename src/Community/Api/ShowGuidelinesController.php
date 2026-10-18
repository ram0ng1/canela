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

namespace Ramon\Canela\Community\Api;

use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Community\AdminText;
use Ramon\Canela\Community\Community;

/**
 * GET /api/canela-guidelines — as "Diretrizes" (/guidelines e /faq do
 * Discourse): o texto do admin, ou, sem ele, o padrão do tema no idioma do
 * fórum (inspirado nas diretrizes que o Discourse traz de fábrica).
 */
final class ShowGuidelinesController implements RequestHandlerInterface
{
    public function __construct(
        private readonly Community $community,
        private readonly SettingsRepositoryInterface $settings,
        private readonly TranslatorInterface $translator,
        private readonly AdminText $text,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->community->assertEnabled(Community::GUIDELINES_ENABLED);

        RequestUtil::getActor($request)->assertCan('viewForum');

        $custom = trim((string) $this->settings->get(Community::GUIDELINES_TEXT));

        return new JsonResponse([
            'html' => $this->text->render($custom !== '' ? $custom : $this->defaultText(), $request),
            'custom' => $custom !== '',
        ]);
    }

    private function defaultText(): string
    {
        $locale = method_exists($this->translator, 'getLocale') ? (string) $this->translator->getLocale() : 'pt_BR';
        $file = str_starts_with(strtolower($locale), 'en') ? 'en' : 'pt-BR';

        return (string) @file_get_contents(dirname(__DIR__).'/Content/guidelines/'.$file.'.md');
    }
}
