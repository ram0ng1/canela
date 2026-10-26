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

namespace Ramon\Canela\Ai\Http;

use Laminas\Diactoros\CallbackStream;
use Laminas\Diactoros\Response;
use Psr\Http\Message\ResponseInterface;
use Throwable;

/**
 * Uma resposta que chega ao navegador enquanto é escrita: JSON delimitado por
 * linha (NDJSON), um objeto por linha, cada um completo em si — o mesmo
 * formato do "Limpar cache" do core 2.0.
 *
 * O corpo é um CallbackStream: o Emitter do Flarum o reconhece e o transmite
 * aos poucos, depois que os middlewares da API (sessão, CSRF, erros) já
 * fizeram o trabalho deles com o objeto da resposta.
 *
 * Depois que os cabeçalhos saíram, um erro não pode mais virar 500: ele vira
 * uma linha `{"type":"error"}`, e o stream termina com `{"type":"done"}` — o
 * navegador olha para essa linha, e não para a conexão fechando, que ele não
 * distinguiria de uma conexão que caiu.
 */
final class NdjsonStream
{
    /**
     * @param callable(callable(string, array<string, mixed>): void): void $work recebe o `write(tipo, dados)`
     * @param callable(Throwable): string $describe transforma uma exceção na mensagem para quem usa
     */
    public static function response(callable $work, callable $describe): ResponseInterface
    {
        return (new Response())
            ->withHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
            // Um proxy que comprime ou junta a resposta antes de mandar
            // mataria o efeito de "digitando".
            ->withHeader('Cache-Control', 'no-cache, no-transform')
            ->withHeader('X-Accel-Buffering', 'no')
            ->withBody(new CallbackStream(static function () use ($work, $describe): string {
                // A resposta é gravada no fim mesmo que a pessoa feche a aba
                // no meio: o que o provedor já cobrou não pode sumir.
                ignore_user_abort(true);
                if (function_exists('set_time_limit')) {
                    set_time_limit(300);
                }

                // O output_buffering do php.ini seguraria as linhas até juntar
                // 4 KB; aqui cada linha precisa sair na hora.
                while (ob_get_level() > 0) {
                    @ob_end_flush();
                }

                $write = static function (string $type, array $data = []): void {
                    if (connection_aborted()) {
                        return;
                    }

                    echo json_encode(['type' => $type] + $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE)."\n";
                    flush();
                };

                try {
                    $work($write);
                } catch (Throwable $error) {
                    $write('error', ['message' => $describe($error)]);
                }

                $write('done');

                return '';
            }));
    }
}
