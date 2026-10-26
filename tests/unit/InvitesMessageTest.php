<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Gaps\Invites\Http\InvitesController;
use Symfony\Component\Yaml\Yaml;

/** A mensagem de "convites demais" vem das traduções, nos três idiomas, e não do código. */
final class InvitesMessageTest extends TestCase
{
    /** @return array<string, array{string}> */
    public static function locales(): array
    {
        return ['pt-BR' => ['pt-BR'], 'en' => ['en'], 'ja' => ['ja']];
    }

    #[DataProvider('locales')]
    public function test_chave_existe_no_idioma(string $locale): void
    {
        $value = Yaml::parseFile(dirname(__DIR__, 2)."/locale/$locale.yml");

        foreach (explode('.', InvitesController::TOO_MANY_KEY) as $part) {
            self::assertIsArray($value);
            self::assertArrayHasKey($part, $value);
            $value = $value[$part];
        }

        self::assertIsString($value);
        self::assertNotSame('', trim($value));
    }

    public function test_sem_texto_fixo_no_controlador(): void
    {
        $source = (string) file_get_contents(dirname(__DIR__, 2).'/src/Gaps/Invites/Http/InvitesController.php');

        self::assertStringNotContainsString('Apague algum antes de gerar outro', $source);
    }
}
