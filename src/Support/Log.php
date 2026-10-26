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

use Illuminate\Container\Container;
use Psr\Log\LoggerInterface;

/**
 * Falhas que o tema contorna (um recurso desligado, o realtime que cai para
 * o polling...) vão para o log do Flarum (storage/logs), onde o admin olha.
 * Só quando o log ainda não existe (o boot não terminou) elas caem no
 * error_log do PHP, para nada se perder.
 */
final class Log
{
    public const PREFIX = '[ramon/canela] ';

    private static ?LoggerInterface $logger = null;

    public static function warning(string $message): void
    {
        $logger = self::logger();

        if ($logger === null) {
            error_log(self::PREFIX.$message);

            return;
        }

        try {
            $logger->warning(self::PREFIX.$message);
        } catch (\Throwable) {
            error_log(self::PREFIX.$message);
        }
    }

    /** Para os testes: troca (ou limpa, com null) o log usado. */
    public static function use(?LoggerInterface $logger): void
    {
        self::$logger = $logger;
    }

    private static function logger(): ?LoggerInterface
    {
        if (self::$logger !== null) {
            return self::$logger;
        }

        $container = Container::getInstance();

        if (! $container->bound(LoggerInterface::class)) {
            return null;
        }

        try {
            $logger = $container->make(LoggerInterface::class);
        } catch (\Throwable) {
            return null;
        }

        return $logger instanceof LoggerInterface ? self::$logger = $logger : null;
    }
}
