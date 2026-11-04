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

namespace Ramon\Canela\Ai\Translation;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Ai\Http\AiGate;
use Ramon\Canela\Community\AboutPages;
use Ramon\Canela\Community\AdminText;
use Ramon\Canela\Community\Community;
use Ramon\Canela\Community\GuidelinesPage;

/**
 * `POST /api/canela/ai/translate-page` com `{source: "guidelines" | "page:3"}`:
 * a página da área Sobre (Diretrizes, Termos, Privacidade, abas extras) no
 * idioma de quem lê.
 *
 * Só o nome da página vem do fórum: o HTML é o do servidor, com a
 * visibilidade de sempre (a página do fof/pages que a pessoa não vê é 404).
 * A resposta é `html` + `title` + `locale`, `skip` (já no idioma, ou nada
 * mudou) ou `pending` (o fórum pede de novo), como a das postagens; os mesmos
 * limites por minuto e, para visitantes, por dia.
 */
final class TranslatePageController implements RequestHandlerInterface
{
    private const PER_MINUTE = 20;

    private const GUEST_CALLS_PER_DAY = 60;

    public function __construct(
        private readonly ContentTranslator $translator,
        private readonly PageTranslator $pages,
        private readonly AboutPages $about,
        private readonly GuidelinesPage $guidelines,
        private readonly AdminText $text,
        private readonly SettingsRepositoryInterface $settings,
        private readonly Cache $cache,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $target = $this->translator->target();

        if ($target === null) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $actor->assertCan('viewForum');

        $source = (string) (AiGate::body($request)['source'] ?? '');
        $page = preg_match('/^(guidelines|page:[1-9]\d{0,8})$/', $source) === 1 ? $this->resolve($source, $actor, $request) : null;

        if ($page === null) {
            throw new RouteNotFoundException();
        }

        $who = $actor->isGuest() ? 'ip:'.sha1((string) $request->getAttribute('ipAddress')) : 'user:'.$actor->id;
        $key = 'canela-ai-translate-page-rate:'.$who.':'.intdiv(time(), 60);
        $this->cache->add($key, 0, 120);

        if ((int) $this->cache->increment($key) > self::PER_MINUTE) {
            return new JsonResponse(['pending' => true, 'retryAfter' => 60]);
        }

        if (function_exists('set_time_limit')) {
            set_time_limit(120);
        }

        if ($actor->isGuest()) {
            $this->translator->limitCaller($who, self::GUEST_CALLS_PER_DAY);
        }

        return new JsonResponse($this->pages->translate($source, $page['title'], $page['html'], $target));
    }

    /**
     * O título e o HTML da página, como a área Sobre os mostra a esta pessoa.
     *
     * @return array{title: string, html: string}|null
     */
    private function resolve(string $source, User $actor, ServerRequestInterface $request): ?array
    {
        if ($source === 'guidelines') {
            if (! (bool) $this->settings->get(Community::GUIDELINES_ENABLED)) {
                return null;
            }

            $page = $this->guidelines->find($actor);

            if ($page !== null) {
                return ['title' => (string) $page->title, 'html' => $this->guidelines->html($page)];
            }

            $html = $this->text->render((string) $this->settings->get(Community::GUIDELINES_TEXT), $request);

            return $html !== null ? ['title' => '', 'html' => $html] : null;
        }

        $page = $this->about->find($actor, (int) substr($source, 5));

        return $page !== null ? ['title' => (string) $page->title, 'html' => $this->about->html($page)] : null;
    }
}
