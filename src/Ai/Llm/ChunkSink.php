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

use Psr\Http\Message\StreamInterface;
use RuntimeException;

/**
 * O corpo da resposta do provedor, entregue pedaço a pedaço enquanto chega.
 *
 * O Guzzle escreve no `sink` da requisição conforme o cURL recebe os bytes;
 * um stream próprio aqui transforma cada escrita numa chamada ao leitor de SSE.
 * É o caminho oficial do Guzzle para isso — a outra opção, `stream => true`,
 * troca o cURL pelo handler de streams do PHP, que no Windows não acha os
 * certificados (o php.ini só configura o `curl.cainfo`).
 *
 * Guarda também o começo do corpo (até 64 KB), porque uma resposta de erro
 * (401, 429…) chega pelo mesmo caminho e o texto dela explica o problema.
 */
final class ChunkSink implements StreamInterface
{
    private const KEEP_BYTES = 65536;

    private string $kept = '';

    private int $size = 0;

    /**
     * @param callable(string): bool $onChunk devolve false para cortar a transferência
     *                                          (quem pediu fechou a página)
     */
    public function __construct(
        private $onChunk,
    ) {
    }

    public function kept(): string
    {
        return $this->kept;
    }

    #[\Override]
    public function write(string $string): int
    {
        $length = strlen($string);
        $this->size += $length;

        if (strlen($this->kept) < self::KEEP_BYTES) {
            $this->kept .= substr($string, 0, self::KEEP_BYTES - strlen($this->kept));
        }

        // Devolver 0 ao cURL interrompe a transferência: sem ninguém do outro
        // lado, cada token a mais seria pago à toa.
        return ($this->onChunk)($string) === false ? 0 : $length;
    }

    #[\Override]
    public function __toString(): string
    {
        return $this->kept;
    }

    #[\Override]
    public function close(): void
    {
    }

    #[\Override]
    public function detach()
    {
        return null;
    }

    #[\Override]
    public function getSize(): ?int
    {
        return $this->size;
    }

    #[\Override]
    public function tell(): int
    {
        return $this->size;
    }

    #[\Override]
    public function eof(): bool
    {
        return true;
    }

    #[\Override]
    public function isSeekable(): bool
    {
        return false;
    }

    #[\Override]
    public function seek(int $offset, int $whence = SEEK_SET): void
    {
        throw new RuntimeException('ChunkSink não é posicionável.');
    }

    #[\Override]
    public function rewind(): void
    {
        throw new RuntimeException('ChunkSink não é posicionável.');
    }

    #[\Override]
    public function isWritable(): bool
    {
        return true;
    }

    #[\Override]
    public function isReadable(): bool
    {
        return false;
    }

    #[\Override]
    public function read(int $length): string
    {
        throw new RuntimeException('ChunkSink só recebe escrita.');
    }

    #[\Override]
    public function getContents(): string
    {
        return $this->kept;
    }

    #[\Override]
    public function getMetadata(?string $key = null)
    {
        return $key === null ? [] : null;
    }
}
