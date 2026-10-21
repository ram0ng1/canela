<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\System\Messages\AutoMessages;

/** As mensagens automáticas: as variáveis no formato `%{nome}` e as chaves do admin. */
final class AutoMessagesTest extends TestCase
{
    public function test_troca_as_variaveis_com_percentual_e_com_chaves(): void
    {
        $text = AutoMessages::interpolate('Boas-vindas ao %{site_name}, {username}!', ['site_name' => 'Canela', 'username' => 'ana']);

        self::assertSame('Boas-vindas ao Canela, ana!', $text);
    }

    public function test_variavel_desconhecida_fica_como_esta(): void
    {
        self::assertSame('Oi %{nome_errado}', AutoMessages::interpolate('Oi %{nome_errado}', ['username' => 'ana']));
    }

    public function test_valor_com_cifrao_e_barra_entra_literal(): void
    {
        self::assertSame('Motivo: $1 \\2', AutoMessages::interpolate('Motivo: %{reason}', ['reason' => '$1 \\2']));
    }

    public function test_chaves_das_configuracoes(): void
    {
        self::assertSame('canela.sysmsg_welcome_user', AutoMessages::setting(AutoMessages::WELCOME_USER));
        self::assertSame('canela.sysmsg_welcome_user_body', AutoMessages::setting(AutoMessages::WELCOME_USER, 'body'));
        self::assertSame('ramon-canela.admin.sysmsg.unsilenced.subject', AutoMessages::translationKey(AutoMessages::UNSUSPENDED, 'subject'));
    }

    public function test_cada_tipo_tem_textos_padrao_nos_tres_idiomas(): void
    {
        foreach (['pt-BR', 'en', 'ja'] as $locale) {
            $yaml = \Symfony\Component\Yaml\Yaml::parseFile(__DIR__.'/../../locale/'.$locale.'.yml');
            $messages = $yaml['ramon-canela']['admin']['sysmsg'] ?? [];

            foreach (array_keys(AutoMessages::TYPES) as $type) {
                self::assertNotEmpty($messages[$type]['subject'] ?? null, "$locale: $type.subject");
                self::assertNotEmpty($messages[$type]['body'] ?? null, "$locale: $type.body");
            }
        }
    }

    public function test_so_boas_vindas_e_niveis_saem_uma_vez(): void
    {
        $once = array_keys(array_filter(AutoMessages::TYPES, static fn (array $type): bool => $type['once']));

        self::assertSame([AutoMessages::WELCOME_USER, AutoMessages::WELCOME_INVITE, AutoMessages::WELCOME_TL1, AutoMessages::TL2_PROMOTION], $once);
        self::assertFalse(AutoMessages::TYPES[AutoMessages::ADDED_TO_GROUP]['default']);
    }
}
