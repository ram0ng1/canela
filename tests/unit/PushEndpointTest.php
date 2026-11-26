<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Push\Push;

/**
 * O servidor faz um POST para o endpoint a cada notificação: só os serviços
 * de push dos navegadores passam, nunca um endereço da rede interna.
 */
final class PushEndpointTest extends TestCase
{
    /** @return array<string, array{string}> */
    public static function aceitos(): array
    {
        return [
            'chrome' => ['https://fcm.googleapis.com/fcm/send/abc:APA91b'],
            'firefox' => ['https://updates.push.services.mozilla.com/wpush/v2/gAAAA'],
            'windows' => ['https://wns2-par02p.notify.windows.com/w/?token=BQYAAA'],
            'safari' => ['https://web.push.apple.com/QGuQyavXutnMH'],
        ];
    }

    /** @return array<string, array{string}> */
    public static function recusados(): array
    {
        return [
            'http' => ['http://fcm.googleapis.com/fcm/send/abc'],
            'rede interna' => ['https://10.0.0.5/push'],
            'localhost' => ['https://localhost/push'],
            'porta' => ['https://fcm.googleapis.com:8443/fcm/send/abc'],
            'usuário na url' => ['https://fcm.googleapis.com@10.0.0.5/push'],
            'sufixo falso' => ['https://evilpush.apple.com.example.com/x'],
            'parecido' => ['https://notfcm.googleapis.com/fcm/send/abc'],
            'vazio' => [''],
        ];
    }

    #[DataProvider('aceitos')]
    public function test_aceita_os_servicos_de_push(string $endpoint): void
    {
        self::assertTrue(Push::allowedEndpoint($endpoint));
    }

    #[DataProvider('recusados')]
    public function test_recusa_o_resto(string $endpoint): void
    {
        self::assertFalse(Push::allowedEndpoint($endpoint));
    }
}
