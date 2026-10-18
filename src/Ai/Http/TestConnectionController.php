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

namespace Ramon\Canela\Ai\Http;

use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Embeddings\RelatedTopics;
use Ramon\Canela\Ai\Llm\LlmException;
use Ramon\Canela\Ai\Llm\LlmFactory;
use Ramon\Canela\Ai\Llm\LlmRequest;

/**
 * `POST /api/canela/ai/test`: o "Testar conexão" do admin.
 *
 * Um pedido mínimo a cada modelo configurado (o principal e o rápido) — e, com
 * `target: embeddings`, à API de embeddings —, devolvendo o que deu certo e a
 * mensagem crua do provedor quando falha: só o admin vê, e é ela que diz se a
 * chave está errada, o modelo não existe ou falta crédito.
 *
 * Funciona com a IA desligada e antes do `migrate`: é o jeito de conferir a
 * chave antes de abrir o recurso.
 */
final class TestConnectionController implements RequestHandlerInterface
{
    public function __construct(
        private readonly AiSettings $settings,
        private readonly LlmFactory $llm,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        $target = (string) (AiGate::body($request)['target'] ?? 'llm');

        if ($target === 'embeddings') {
            return new JsonResponse(['data' => [$this->embeddings()]]);
        }

        $results = [];

        foreach (array_unique([$this->settings->mainModel(), $this->settings->fastModel()]) as $model) {
            $results[] = $this->model($model);
        }

        return new JsonResponse(['data' => $results]);
    }

    /**
     * @return array{target: string, ok: bool, message: string, ms: int}
     */
    private function model(string $model): array
    {
        $started = microtime(true);

        try {
            if ($model === '') {
                throw new LlmException('not_configured', 'Nenhum modelo configurado.');
            }

            $result = $this->llm->make()->send(new LlmRequest($model, '', [['role' => 'user', 'content' => 'Responda apenas: ok']], [], 512, 'low'));

            return ['target' => $model, 'ok' => true, 'message' => trim(mb_substr($result->text, 0, 80)) ?: $result->stopReason, 'ms' => (int) ((microtime(true) - $started) * 1000)];
        } catch (LlmException $error) {
            return ['target' => $model, 'ok' => false, 'message' => $error->getMessage(), 'ms' => (int) ((microtime(true) - $started) * 1000)];
        }
    }

    /**
     * @return array{target: string, ok: bool, message: string, ms: int}
     */
    private function embeddings(): array
    {
        $started = microtime(true);
        $model = $this->settings->string(AiSettings::EMBEDDINGS_MODEL);

        try {
            $values = resolve(RelatedTopics::class)->probe();

            return ['target' => $model, 'ok' => true, 'message' => sprintf('%d dimensões', $values), 'ms' => (int) ((microtime(true) - $started) * 1000)];
        } catch (LlmException $error) {
            return ['target' => $model, 'ok' => false, 'message' => $error->getMessage(), 'ms' => (int) ((microtime(true) - $started) * 1000)];
        }
    }
}
