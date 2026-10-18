<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Support;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * Configurações em memória: as classes de configuração do tema só leem
 * `get()`, e os testes não precisam do banco para isso.
 */
final class ArraySettings implements SettingsRepositoryInterface
{
    /** @param array<string, mixed> $values */
    public function __construct(
        private array $values = []
    ) {
    }

    #[\Override]
    public function all(): array
    {
        return $this->values;
    }

    #[\Override]
    public function get(string $key, mixed $default = null): mixed
    {
        return $this->values[$key] ?? $default;
    }

    #[\Override]
    public function set(string $key, mixed $value): void
    {
        $this->values[$key] = $value;
    }

    #[\Override]
    public function delete(string $keyLike): void
    {
        unset($this->values[$keyLike]);
    }
}
