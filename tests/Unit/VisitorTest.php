<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use Laminas\Diactoros\ServerRequest;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Stats\Http\Visitor;

/** Robô não conta visualização nem clique; visitante é reconhecido pelo IP com sal. */
final class VisitorTest extends TestCase
{
    private function visitor(string $userAgent, string $ip = '10.0.0.1'): Visitor
    {
        return new Visitor((new ServerRequest())->withHeader('User-Agent', $userAgent)->withAttribute('ipAddress', $ip));
    }

    /** @return array<string, array{0: string, 1: bool}> */
    public static function agents(): array
    {
        return [
            'chrome' => ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', false],
            'firefox' => ['Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', false],
            'iphone' => ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', false],
            'vazio' => ['', true],
            'curl' => ['curl/8.5.0', true],
            'googlebot' => ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/130.0 Safari/537.36', true],
            'gptbot' => ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot', true],
            'headless' => ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0 Safari/537.36', true],
            'facebook' => ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', true],
        ];
    }

    #[DataProvider('agents')]
    public function test_deteccao_de_robo(string $userAgent, bool $crawler): void
    {
        self::assertSame($crawler, $this->visitor($userAgent)->isCrawler());
    }

    public function test_celular(): void
    {
        self::assertTrue($this->visitor('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36')->isMobile());
        self::assertFalse($this->visitor('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130 Safari/537.36')->isMobile());
    }

    public function test_hash_do_ip_ignora_o_navegador_e_depende_do_sal(): void
    {
        $a = $this->visitor('Mozilla/5.0 Firefox', '10.0.0.1');
        $b = $this->visitor('Mozilla/5.0 Chrome', '10.0.0.1');

        self::assertSame($a->ipHash('sal'), $b->ipHash('sal'));
        self::assertNotSame($a->ipHash('sal'), $a->ipHash('outro'));
        self::assertNotSame($a->ipHash('sal'), $this->visitor('Mozilla/5.0 Firefox', '10.0.0.2')->ipHash('sal'));
        // O hash com o navegador separa duas pessoas atrás do mesmo NAT.
        self::assertNotSame($a->hash('sal'), $b->hash('sal'));
        self::assertDoesNotMatchRegularExpression('/10\.0\.0\.1/', $a->ipHash('sal'));
    }
}
