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

namespace Ramon\Canela\Ai\Llm;

/**
 * Leitor de Server-Sent Events, pedaço a pedaço.
 *
 * Os bytes chegam em pedaços que não respeitam o fim dos eventos: o que vem
 * depois da última linha em branco espera o próximo pedaço. Cada evento
 * completo (as linhas `event:` e `data:`) vai para o callback.
 */
final class SseParser
{
    private string $buffer = '';

    /**
     * @param callable(string, string): void $onEvent recebe o nome do evento e o `data`
     */
    public function __construct(
        private $onEvent,
    ) {
    }

    public function feed(string $chunk): void
    {
        $this->buffer .= str_replace("\r\n", "\n", $chunk);

        while (($end = strpos($this->buffer, "\n\n")) !== false) {
            $raw = substr($this->buffer, 0, $end);
            $this->buffer = substr($this->buffer, $end + 2);
            $this->dispatch($raw);
        }
    }

    /** O que sobrou sem a linha em branco final (alguns servidores não a mandam). */
    public function finish(): void
    {
        if (trim($this->buffer) !== '') {
            $this->dispatch($this->buffer);
        }

        $this->buffer = '';
    }

    private function dispatch(string $raw): void
    {
        $event = 'message';
        $data = [];

        foreach (explode("\n", $raw) as $line) {
            if ($line === '' || $line[0] === ':') {
                continue;
            }

            [$field, $value] = array_pad(explode(':', $line, 2), 2, '');
            $value = ltrim($value, ' ');

            if ($field === 'event') {
                $event = $value;
            } elseif ($field === 'data') {
                $data[] = $value;
            }
        }

        if ($data !== []) {
            ($this->onEvent)($event, implode("\n", $data));
        }
    }
}
