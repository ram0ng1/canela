<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats\Http;

use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\VisitRecorder;
use Throwable;

/**
 * Conta o dia de visita de quem entrou na conta.
 *
 * Nas duas pilhas, fórum e API: a página do fórum só é carregada uma vez, e
 * quem deixa a aba aberta de um dia para o outro continua navegando só pela
 * API — sem ela, o segundo dia não contaria.
 */
final class RecordVisitMiddleware implements MiddlewareInterface
{
    public function __construct(
        private readonly StatsSettings $settings,
        private readonly VisitRecorder $visits,
        private readonly LoggerInterface $logger
    ) {
    }

    #[\Override]
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if (! $actor->isGuest() && $this->settings->activityEnabled()) {
            try {
                $this->visits->touch($actor, (new Visitor($request))->isMobile());
            } catch (Throwable $error) {
                // Uma estatística que falha não pode derrubar a página.
                $this->logger->warning('[canela] visita não registrada: '.$error->getMessage());
            }
        }

        return $handler->handle($request);
    }
}
