<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats\Api;

use Flarum\Api\Context;
use Flarum\Discussion\Discussion;
use Psr\Log\LoggerInterface;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\TopicViewRecorder;
use Throwable;

/**
 * Gancho `after` do endpoint Show das discussões: abrir o tópico é o que conta
 * a visualização.
 *
 * No servidor, e não numa chamada do navegador, porque o Show roda nos dois
 * caminhos de abertura — a página carregada direto (o fórum pede o tópico à API
 * por dentro para pré-carregá-lo) e a navegação dentro do app (a DiscussionPage
 * sempre busca o tópico) — e também para quem lê sem JavaScript. Um POST do
 * navegador perderia esses casos e custaria uma requisição a mais por tópico.
 */
final class RecordTopicView
{
    public function __construct(
        private readonly TopicViewRecorder $recorder,
        private readonly StatsSettings $settings,
        private readonly LoggerInterface $logger
    ) {
    }

    public function __invoke(Context $context, Discussion $discussion): Discussion
    {
        if (! $this->settings->viewsEnabled()) {
            return $discussion;
        }

        try {
            $this->recorder->record($discussion, $context->getActor(), $context->request);
        } catch (Throwable $error) {
            // Uma estatística nunca pode impedir alguém de ler o tópico: se a
            // tabela ainda não existe (migração pendente) ou o banco recusou a
            // escrita, o tópico abre do mesmo jeito.
            $this->logger->warning('[canela] visualização não registrada: '.$error->getMessage());
        }

        return $discussion;
    }
}
