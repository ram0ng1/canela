<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use Laminas\Diactoros\StreamFactory;
use Laminas\Diactoros\UploadedFile;
use PHPUnit\Framework\TestCase;
use Psr\Log\AbstractLogger;
use Ramon\Canela\Support\Log;
use Ramon\Canela\Support\UploadedBytes;

/**
 * As falhas contornadas vão para o log do Flarum, e os uploads são lidos
 * pelo fluxo do PSR-7 (vale também para um fluxo em memória, sem arquivo).
 */
final class SupportLogAndUploadTest extends TestCase
{
    private const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    #[\Override]
    protected function tearDown(): void
    {
        Log::use(null);
    }

    public function test_falha_vai_para_o_log_do_flarum_com_o_prefixo(): void
    {
        $logger = new class extends AbstractLogger {
            /** @var list<array{string, string}> */
            public array $lines = [];

            public function log($level, \Stringable|string $message, array $context = []): void
            {
                $this->lines[] = [(string) $level, (string) $message];
            }
        };

        Log::use($logger);
        Log::warning('chat: websocket indisponível');

        self::assertSame([['warning', '[ramon/canela] chat: websocket indisponível']], $logger->lines);
    }

    public function test_sem_log_do_flarum_cai_no_error_log(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'canela-log');
        $before = ini_set('error_log', (string) $file);

        try {
            Log::warning('recurso x desligado: boom');
        } finally {
            ini_set('error_log', (string) $before);
        }

        self::assertStringContainsString('[ramon/canela] recurso x desligado: boom', (string) file_get_contents((string) $file));
        unlink((string) $file);
    }

    public function test_upload_em_memoria_e_lido_pelo_fluxo(): void
    {
        $png = (string) base64_decode(self::PNG_1PX, true);
        $stream = (new StreamFactory())->createStream($png);
        $stream->read(4); // o fluxo pode chegar já lido em parte
        $file = new UploadedFile($stream, strlen($png), UPLOAD_ERR_OK, 'x.png', 'image/png');

        self::assertSame('php://temp', $stream->getMetadata('uri'), 'o fluxo não é um arquivo em disco');

        $bytes = UploadedBytes::of($file);

        self::assertSame($png, $bytes);
        self::assertSame('image/png', UploadedBytes::mime($bytes));
        self::assertSame($png, UploadedBytes::of($file), 'dá para ler de novo');
        self::assertSame(1, (new ImageManager(new Driver()))->read($bytes)->width());
    }

    public function test_tipo_sai_do_conteudo_e_nao_do_nome(): void
    {
        self::assertSame('text/plain', UploadedBytes::mime('não sou uma imagem'));
        self::assertNull(UploadedBytes::mime(''));
    }
}
