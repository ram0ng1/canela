<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Profile\Api\UserProfileFields;
use Ramon\Canela\Profile\ProfileSettings;
use Ramon\Canela\Tests\Support\ArraySettings;

/** As regras dos campos do perfil que não dependem do banco. */
final class ProfileValidationTest extends TestCase
{
    /** @return array<string, array{0: string, 1: bool}> */
    public static function emojis(): array
    {
        return [
            'simples' => ["\u{1F600}", true],
            'com seletor' => ["\u{2764}\u{FE0F}", true],
            'tom de pele' => ["\u{1F44D}\u{1F3FD}", true],
            'família com ZWJ' => ["\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}", true],
            'bandeira' => ["\u{1F1E7}\u{1F1F7}", true],
            'tecla' => ["1\u{FE0F}\u{20E3}", true],
            'texto' => ['ok', false],
            'só dígito' => ['1', false],
            'emoji com texto' => ["\u{1F600} oi", false],
            'html' => ['<b>', false],
            'vazio' => ['', false],
        ];
    }

    #[DataProvider('emojis')]
    public function test_emoji_do_status(string $value, bool $valid): void
    {
        self::assertSame($valid, preg_match(UserProfileFields::EMOJI_PATTERN, $value) === 1);
    }

    /** @return array<string, array{0: ?string, 1: ?string}> */
    public static function lines(): array
    {
        return [
            'nulo' => [null, null],
            'só espaço' => ["  \n\t ", null],
            'quebras viram espaço' => ["São\r\nPaulo\tSP", 'São Paulo SP'],
            'espaços repetidos' => ['a    b', 'a b'],
            'controles e direção' => ["\u{202E}abc\u{0000}", 'abc'],
        ];
    }

    #[DataProvider('lines')]
    public function test_campo_de_uma_linha(?string $value, ?string $expected): void
    {
        $singleLine = (static fn (?string $value): ?string => self::singleLine($value))->bindTo(null, UserProfileFields::class);

        self::assertSame($expected, $singleLine($value));
    }

    public function test_tamanho_da_bio_tem_piso_e_teto(): void
    {
        $max = static fn (mixed $value): int => (new ProfileSettings(new ArraySettings([ProfileSettings::BIO_MAX_LENGTH => $value])))->bioMaxLength();

        self::assertSame(ProfileSettings::BIO_MAX_LENGTH_DEFAULT, $max(null));
        self::assertSame(ProfileSettings::BIO_MAX_LENGTH_DEFAULT, $max('0'));
        self::assertSame(ProfileSettings::BIO_MAX_LENGTH_DEFAULT, $max('-5'));
        self::assertSame(200, $max('200'));
        self::assertSame(ProfileSettings::BIO_MAX_LENGTH_CEILING, $max('999999'));
    }

    public function test_campo_desligado_quando_o_perfil_esta_desligado(): void
    {
        $settings = new ProfileSettings(new ArraySettings([ProfileSettings::fieldKey(ProfileSettings::BIO) => '1']));
        self::assertFalse($settings->fieldEnabled(ProfileSettings::BIO));

        $settings = new ProfileSettings(new ArraySettings([ProfileSettings::ENABLED => '1', ProfileSettings::fieldKey(ProfileSettings::BIO) => '1']));
        self::assertTrue($settings->fieldEnabled(ProfileSettings::BIO));
        self::assertFalse($settings->fieldEnabled(ProfileSettings::STATUS));
    }
}
