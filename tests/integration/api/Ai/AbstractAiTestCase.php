<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Ai;

use Flarum\Extend;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Tests\integration\api\Ai\Fake\FakeLlm;
use Ramon\Canela\Tests\integration\api\Ai\Fake\FakeLlmFactory;
use Ramon\Canela\Tests\integration\api\Ai\Fake\FakeLlmServiceProvider;

/**
 * A base dos testes da IA: o tema ligado, o provedor falso no container
 * (FakeLlm) e a IA "configurada" com uma chave qualquer — nenhuma chamada sai
 * da máquina.
 *
 * Pessoas: 1 administrador, 2 membro comum, 3 outro membro.
 */
abstract class AbstractAiTestCase extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        FakeLlm::reset();
        FakeLlmFactory::$configured = true;

        $this->extension('ramon-canela');
        $this->extend((new Extend\ServiceProvider())->register(FakeLlmServiceProvider::class));

        $this->setting(AiSettings::ANTHROPIC_KEY, 'chave-de-teste');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'outra', 'email' => 'outra@machine.local', 'is_email_confirmed' => 1],
            ],
        ]);
    }

    /** @return array<string, mixed> */
    protected function body(ResponseInterface $response): array
    {
        return json_decode((string) $response->getBody(), true) ?? [];
    }

    /**
     * As linhas de uma resposta em streaming (NDJSON). O corpo é escrito com
     * `echo` quando é lido; o buffer aberto aqui o recolhe.
     *
     * @return list<array<string, mixed>>
     */
    protected function lines(ResponseInterface $response): array
    {
        ob_start();

        try {
            $rest = (string) $response->getBody();
        } finally {
            $output = (string) ob_get_clean();
        }

        $lines = [];

        foreach (explode("\n", $output.$rest) as $line) {
            if (trim($line) !== '') {
                $lines[] = json_decode($line, true);
            }
        }

        return $lines;
    }

    /** @param list<array<string, mixed>> $lines */
    protected function types(array $lines): array
    {
        return array_column($lines, 'type');
    }

    /** Tira uma permissão de todos os grupos (as migrações a deram aos membros). */
    protected function revoke(string $permission): void
    {
        $this->database()->table('group_permission')->where('permission', $permission)->delete();
    }
}
