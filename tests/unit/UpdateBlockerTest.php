<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use Flarum\Foundation\Paths;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\Update\UpdateBlocker;

/** Quais constraints do composer.json do fórum impedem o update de subir de versão. */
final class UpdateBlockerTest extends TestCase
{
    /** @return array<string,array{string,bool}> */
    public static function constraints(): array
    {
        return [
            'caret em 0.x (composer require sem versão)' => ['^0.1.11', true],
            'til em 0.x' => ['~0.2.4', true],
            'versão exata' => ['0.2.4', true],
            'versão exata com v' => ['v0.2.4', true],
            'qualquer versão' => ['*', false],
            'caret em 1.x' => ['^1.0', false],
            'intervalo aberto' => ['>=0.1', false],
            'duas séries' => ['^0.1 || ^0.2', false],
        ];
    }

    #[DataProvider('constraints')]
    public function test_constraint(string $constraint, bool $blocks): void
    {
        self::assertSame($blocks, UpdateBlocker::blocks($constraint));
    }

    public function test_le_o_composer_json_do_forum(): void
    {
        $dir = sys_get_temp_dir().'/canela-update-'.uniqid();
        mkdir($dir);
        file_put_contents($dir.'/composer.json', json_encode(['require' => ['ramon/canela' => '^0.1.11']]));
        $paths = new Paths(['base' => $dir, 'public' => $dir, 'storage' => $dir]);

        self::assertSame('^0.1.11', (new UpdateBlocker($paths))->constraint());

        file_put_contents($dir.'/composer.json', json_encode(['require' => ['ramon/canela' => '*']]));
        self::assertNull((new UpdateBlocker($paths))->constraint());

        unlink($dir.'/composer.json');
        self::assertNull((new UpdateBlocker($paths))->constraint());
        rmdir($dir);
    }
}
