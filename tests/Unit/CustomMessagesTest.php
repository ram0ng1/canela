<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\System\Messages\CustomMessages;

/** O JSON das mensagens personalizadas que chega do admin, limpo ao salvar. */
final class CustomMessagesTest extends TestCase
{
    /** @return list<array<string, mixed>> */
    private function normalize(array $entries): array
    {
        return json_decode(CustomMessages::normalize(json_encode($entries)), true);
    }

    public function test_descarta_o_que_nao_e_mensagem_e_gatilho_desconhecido(): void
    {
        $result = $this->normalize([
            'texto solto',
            ['id' => 'a', 'trigger' => 'inventado', 'body' => 'x'],
            ['id' => 'b', 'trigger' => 'first_post', 'body' => 'Parabéns', 'createdAt' => '2026-10-19T00:00:00Z'],
        ]);

        self::assertCount(1, $result);
        self::assertSame('b', $result[0]['id']);
        self::assertFalse($result[0]['enabled']);
    }

    public function test_id_e_data_nascem_quando_faltam_e_id_repetido_ganha_outro(): void
    {
        $result = $this->normalize([
            ['trigger' => 'activated', 'body' => 'x'],
            ['id' => 'dup', 'trigger' => 'activated', 'body' => 'x', 'createdAt' => '2026-10-19T00:00:00Z'],
            ['id' => 'dup', 'trigger' => 'activated', 'body' => 'y', 'createdAt' => '2026-10-19T00:00:00Z'],
        ]);

        self::assertCount(3, $result);
        self::assertNotSame('', $result[0]['id']);
        self::assertNotFalse(strtotime($result[0]['createdAt']));
        self::assertSame('dup', $result[1]['id']);
        self::assertNotSame('dup', $result[2]['id']);
    }

    public function test_valor_e_atraso_so_onde_o_gatilho_usa(): void
    {
        $result = $this->normalize([
            ['id' => 'g', 'trigger' => 'group', 'value' => '5', 'delay' => 9, 'createdAt' => '2026-10-19T00:00:00Z'],
            ['id' => 'a', 'trigger' => 'activated', 'value' => 3, 'delay' => 9999, 'createdAt' => '2026-10-19T00:00:00Z'],
            ['id' => 'n', 'trigger' => 'anniversary', 'value' => 80, 'createdAt' => '2026-10-19T00:00:00Z'],
            ['id' => 'v', 'trigger' => 'verified', 'value' => 2, 'createdAt' => '2026-10-19T00:00:00Z'],
        ]);

        self::assertSame([5, 0], [$result[0]['value'], $result[0]['delay']]);
        self::assertSame([null, CustomMessages::MAX_DELAY_DAYS], [$result[1]['value'], $result[1]['delay']]);
        self::assertSame(CustomMessages::MAX_YEARS, $result[2]['value']);
        self::assertNull($result[3]['value']);
    }

    public function test_limite_de_mensagens(): void
    {
        $many = array_map(static fn (int $i): array => ['id' => 'm'.$i, 'trigger' => 'first_post', 'createdAt' => '2026-10-19T00:00:00Z'], range(1, 40));

        self::assertCount(CustomMessages::MAX, $this->normalize($many));
    }

    public function test_json_invalido_vira_lista_vazia(): void
    {
        self::assertSame('[]', CustomMessages::normalize('{nada'));
        self::assertSame('[]', CustomMessages::normalize(null));
    }
}
