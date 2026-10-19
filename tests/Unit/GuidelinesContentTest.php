<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use Flarum\Extension\ExtensionManager;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Community\Community;
use Ramon\Canela\Community\GuidelinesPage;

/** As diretrizes só existem com conteúdo definido no admin: nada de texto padrão. */
final class GuidelinesContentTest extends TestCase
{
    /** @param array<string, string> $values */
    private function page(array $values, bool $fofPages = false): GuidelinesPage
    {
        $settings = $this->createMock(SettingsRepositoryInterface::class);
        $settings->method('get')->willReturnCallback(fn (string $key, mixed $default = null) => $values[$key] ?? $default);

        $extensions = $this->createMock(ExtensionManager::class);
        $extensions->method('isEnabled')->willReturn($fofPages);

        return new GuidelinesPage($settings, $extensions, $this->createMock(TranslatorInterface::class));
    }

    public function test_sem_texto_nem_pagina_nao_ha_conteudo(): void
    {
        self::assertFalse($this->page([])->hasContent());
        self::assertFalse($this->page([Community::GUIDELINES_TEXT => "  \n "])->hasContent());
    }

    public function test_texto_do_admin_conta(): void
    {
        self::assertTrue($this->page([Community::GUIDELINES_TEXT => 'Seja gentil.'])->hasContent());
    }

    public function test_pagina_sem_o_fof_pages_nao_conta(): void
    {
        self::assertFalse($this->page([Community::GUIDELINES_PAGE => '3'])->hasContent());
    }
}
