<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Llm\AnthropicClient;
use Ramon\Canela\Ai\Llm\HttpTransport;
use Ramon\Canela\Ai\Llm\LlmRequest;
use Ramon\Canela\Tests\Support\ArraySettings;

/** O advisor da Anthropic: quando liga, o que vai no pedido e o que volta no próximo. */
final class AdvisorToolTest extends TestCase
{
    /** @return array<string, array{string, string, string, string}> */
    public static function pairs(): array
    {
        return [
            'desligado' => ['anthropic', 'claude-sonnet-5-5', '', ''],
            'Sonnet com Opus' => ['anthropic', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5-5'],
            'Haiku com Fable' => ['anthropic', 'claude-haiku-5-5', 'claude-fable-5-2', 'claude-fable-5-2'],
            'Opus com Opus não vale' => ['anthropic', 'claude-opus-5-5', 'claude-opus-5-5', ''],
            'advisor mais fraco não vale' => ['anthropic', 'claude-opus-5-5', 'claude-sonnet-5-5', ''],
            'modelo principal desconhecido' => ['anthropic', 'claude-3-opus', 'claude-opus-5-5', ''],
            'outro provedor' => ['openai', 'claude-sonnet-5-5', 'claude-opus-5-5', ''],
        ];
    }

    #[DataProvider('pairs')]
    public function test_par_de_modelos(string $provider, string $main, string $advisor, string $expected): void
    {
        $settings = new AiSettings(new ArraySettings([
            AiSettings::PROVIDER => $provider,
            AiSettings::ANTHROPIC_MODEL => $main,
            AiSettings::OPENAI_MODEL => $main,
            AiSettings::ANTHROPIC_ADVISOR_MODEL => $advisor,
        ]));

        self::assertSame($expected, $settings->advisorModel());
    }

    public function test_ferramenta_no_pedido(): void
    {
        $body = $this->body(new LlmRequest('claude-sonnet-5-5', '', [['role' => 'user', 'content' => 'oi']], advisor: 'claude-opus-5-5'));

        self::assertSame(
            ['type' => 'advisor_20260301', 'name' => 'advisor', 'model' => 'claude-opus-5-5', 'max_uses' => 2],
            end($body['tools']),
        );
    }

    public function test_sem_advisor_sem_ferramenta(): void
    {
        $body = $this->body(new LlmRequest('claude-sonnet-5-5', '', [['role' => 'user', 'content' => 'oi']]));

        self::assertArrayNotHasKey('tools', $body);
    }

    public function test_resultado_volta_literalmente(): void
    {
        $blocks = [
            ['type' => 'server_tool_use', 'id' => 'srvtoolu_1', 'name' => 'advisor', 'input' => []],
            ['type' => 'advisor_tool_result', 'tool_use_id' => 'srvtoolu_1', 'content' => ['type' => 'advisor_redacted_result', 'encrypted_content' => 'EqQB…']],
            ['type' => 'text', 'text' => 'Resposta'],
        ];

        self::assertSame($blocks, AnthropicClient::echoableBlocks($blocks));
    }

    public function test_consulta_pendente_volta(): void
    {
        // pause_turn, ou o advisor pedido junto de uma ferramenta do tema: a
        // consulta roda no começo do próximo pedido, então o bloco volta.
        $blocks = [
            ['type' => 'text', 'text' => 'Vou pesquisar.'],
            ['type' => 'server_tool_use', 'id' => 'srvtoolu_1', 'name' => 'advisor', 'input' => []],
            ['type' => 'tool_use', 'id' => 'toolu_1', 'name' => 'forum_search', 'input' => ['query' => 'x']],
        ];

        self::assertSame($blocks, AnthropicClient::echoableBlocks($blocks));
    }

    /** @return array<string, mixed> */
    private function body(LlmRequest $request): array
    {
        $method = new \ReflectionMethod(AnthropicClient::class, 'body');

        return $method->invoke(new AnthropicClient(new HttpTransport(), 'sk-test'), $request, false);
    }
}
