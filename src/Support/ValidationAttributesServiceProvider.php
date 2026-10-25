<?php

declare(strict_types=1);

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Support;

use Flarum\Foundation\AbstractServiceProvider;
use Illuminate\Contracts\Translation\Translator;
use Illuminate\Validation\Factory;
use Illuminate\Validation\Validator;

/**
 * Os nomes dos campos traduzidos nos avisos de validação ("O campo título é
 * obrigatório", e não "O campo title").
 *
 * O validador do Laravel pede ao tradutor a lista `validation.attributes`
 * inteira e só a usa se vier um array; o tradutor do Flarum devolve sempre
 * texto, então os nomes que os pacotes de idioma traduzem
 * (`validation.attributes.title: título`) nunca chegavam ao aviso. Aqui cada
 * validador nasce com esses nomes, um por campo das regras, pedidos um a um.
 * Os nomes que a própria validação já passa continuam valendo por cima.
 */
final class ValidationAttributesServiceProvider extends AbstractServiceProvider
{
    // Sem #[\Override]: o AbstractServiceProvider do Flarum 2 não declara
    // `boot()` (o container o chama quando existe).
    public function boot(): void
    {
        // Só quando alguém valida: resolver o validador no boot pesaria em
        // toda requisição. Já resolvido antes (por outro provider), vale na hora.
        if ($this->container->resolved('validator')) {
            self::install($this->container->make('validator'));

            return;
        }

        $this->container->afterResolving('validator', static function (Factory $factory): void {
            self::install($factory);
        });
    }

    private static function install(Factory $factory): void
    {
        $factory->resolver(static function (Translator $translator, array $data, array $rules, array $messages, array $attributes): Validator {
            return new Validator($translator, $data, $rules, $messages, [...self::translatedNames($translator, $rules), ...$attributes]);
        });
    }

    /**
     * @param array<array-key, mixed> $rules
     *
     * @return array<string, string>
     */
    private static function translatedNames(Translator $translator, array $rules): array
    {
        $names = [];

        foreach (array_keys($rules) as $field) {
            $key = 'validation.attributes.'.$field;
            $name = $translator->get($key);

            if (is_string($name) && $name !== '' && $name !== $key) {
                $names[(string) $field] = $name;
            }
        }

        return $names;
    }
}
