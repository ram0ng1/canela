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

namespace Ramon\Canela\Chat;

use Flarum\Extension\ExtensionManager;
use Flarum\Formatter\Formatter;
use Flarum\User\User;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Support\Log;

/**
 * Transforma o texto digitado no HTML da mensagem ("cooked").
 *
 * Usa o formatador do próprio Flarum — Markdown, BBCode, emoji e menções saem
 * iguais aos dos posts, e o HTML já vem escapado pelo s9e\TextFormatter. Se
 * algum callback de outra extensão falhar com um contexto que não é um Post, a
 * mensagem sai como texto puro em vez de não sair.
 *
 * Menções: no chat se digita `@usuario`. O flarum/mentions só
 * reconhece esse formato com uma opção dele ligada, então, antes de formatar,
 * cada `@usuario` que existe vira o formato completo (`@"Nome"#id`). O texto
 * guardado continua o digitado — é o que a edição mostra.
 */
final class ChatFormatter
{
    /**
     * O alfabeto dos nomes de usuário, com o ponto no meio ("ana.silva") — o
     * ponto final de uma frase ("…fala com @ana.") não entra no nome.
     */
    private const MENTION_REGEX = '/(?<![\w@"`\/])@([a-z0-9_-](?:[a-z0-9_.-]{0,98}[a-z0-9_-])?)(?![\w#"])/i';

    /** Blocos e trechos de código: lá dentro um "@" não é menção. */
    private const CODE_REGEX = '/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/';

    public const EXCERPT_LENGTH = 150;

    public function __construct(
        private readonly Formatter $formatter,
        private readonly ExtensionManager $extensions,
    ) {
    }

    /**
     * @return array{cooked: string, userIds: int[], here: bool, all: bool}
     */
    public function cook(string $text, Message $context, User $actor): array
    {
        $usernames = [];
        $here = false;
        $all = false;

        $this->eachOutsideCode($text, static function (string $chunk) use (&$usernames, &$here, &$all): string {
            if (preg_match_all(self::MENTION_REGEX, $chunk, $matches)) {
                foreach ($matches[1] as $name) {
                    $lower = mb_strtolower($name);
                    match ($lower) {
                        'here' => $here = true,
                        'all' => $all = true,
                        default => $usernames[$lower] = $name,
                    };
                }
            }

            return $chunk;
        });

        $users = $usernames
            ? User::query()->whereIn('username', array_values($usernames))->limit(50)->get()->keyBy(static fn (User $user) => mb_strtolower($user->username))
            : collect();

        $source = $text;

        if ($users->isNotEmpty() && $this->extensions->isEnabled('flarum-mentions')) {
            $source = $this->eachOutsideCode($text, static function (string $chunk) use ($users): string {
                return (string) preg_replace_callback(self::MENTION_REGEX, static function (array $match) use ($users): string {
                    /** @var User|null $user */
                    $user = $users->get(mb_strtolower($match[1]));

                    return $user ? '@"'.str_replace('"', "'", $user->display_name).'"#'.$user->id : $match[0];
                }, $chunk);
            });
        }

        try {
            $xml = $this->formatter->parse($source, $context, $actor);
            $cooked = $this->formatter->render($xml, $context);
        } catch (\Throwable $error) {
            Log::warning('chat: formatação falhou, mensagem em texto puro: '.$error->getMessage());
            $cooked = '<p>'.nl2br(htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')).'</p>';
        }

        return [
            'cooked' => $this->highlightGroupMentions($cooked),
            'userIds' => $users->map(static fn (User $user) => (int) $user->id)->values()->all(),
            'here' => $here && ! $users->has('here'),
            'all' => $all && ! $users->has('all'),
        ];
    }

    /** O texto da mensagem sem HTML, curto, para a resposta citada, o fio e as notificações. */
    public static function excerpt(?string $cooked, int $length = self::EXCERPT_LENGTH): string
    {
        if ($cooked === null || $cooked === '') {
            return '';
        }

        // Emoji do twemoji viram o caractere (o alt), e não somem com as tags.
        $text = (string) preg_replace('/<img[^>]*\balt="([^"]*)"[^>]*>/i', '$1', $cooked);
        $text = html_entity_decode(strip_tags((string) preg_replace('/<(br|\/p|\/li|\/blockquote)[^>]*>/i', ' ', $text)), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));

        return mb_strlen($text) > $length ? rtrim(mb_substr($text, 0, $length - 1)).'…' : $text;
    }

    /**
     * Aplica `$callback` só aos trechos fora de código e devolve o texto remontado.
     *
     * @param callable(string): string $callback
     */
    private function eachOutsideCode(string $text, callable $callback): string
    {
        $parts = preg_split(self::CODE_REGEX, $text, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [$text];

        foreach ($parts as $index => $part) {
            // Com DELIM_CAPTURE os ímpares são os trechos de código capturados.
            if ($index % 2 === 0) {
                $parts[$index] = $callback($part);
            }
        }

        return implode('', $parts);
    }

    /**
     * `@here` e `@all` não são usuários: o formatador os deixa como texto, e
     * aqui eles são destacados como menção. Só nos nós de texto, nunca dentro de
     * atributos ou de blocos de código.
     */
    private function highlightGroupMentions(string $html): string
    {
        if (! preg_match('/@(here|all)\b/i', $html)) {
            return $html;
        }

        $inCode = 0;

        return (string) preg_replace_callback('/(<[^>]+>)|(?<![\w@])@(here|all)\b/i', static function (array $match) use (&$inCode): string {
            if ($match[1] !== '') {
                if (preg_match('/^<(code|pre)\b/i', $match[1])) {
                    $inCode++;
                } elseif (preg_match('/^<\/(code|pre)>/i', $match[1])) {
                    $inCode = max(0, $inCode - 1);
                }

                return $match[1];
            }

            return $inCode > 0 ? $match[0] : '<span class="mention mention--group">@'.strtolower($match[2]).'</span>';
        }, $html);
    }
}
