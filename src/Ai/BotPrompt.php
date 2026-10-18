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

namespace Ramon\Canela\Ai;

use Carbon\Carbon;
use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;

/**
 * O prompt de sistema do bot: o da persona, mais o contexto que toda persona
 * precisa — que fórum é este, que dia é hoje, com quem ela fala e como citar
 * os tópicos.
 *
 * O texto é estável dentro de uma conversa (a data muda só de um dia para o
 * outro): o cache do prompt do provedor depende de o começo do pedido ser
 * idêntico de uma mensagem para a seguinte.
 */
final class BotPrompt
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly UrlGenerator $url,
    ) {
    }

    /**
     * @param array{name: string, prompt: string, search: bool, read: bool, web: bool} $persona
     */
    public function system(array $persona, User $actor, bool $webSearch): string
    {
        $forum = (string) $this->settings->get('forum_title');
        $description = trim((string) $this->settings->get('forum_description'));

        $lines = [
            sprintf('Você é "%s", o assistente de IA do fórum "%s" (%s).', $persona['name'], $forum, $this->url->to('forum')->base()),
        ];

        if ($description !== '') {
            $lines[] = 'Sobre o fórum: '.$description;
        }

        if ($persona['prompt'] !== '') {
            $lines[] = '';
            $lines[] = $persona['prompt'];
        }

        $lines[] = '';
        $lines[] = 'Data de hoje: '.Carbon::now()->toDateString().'.';
        $lines[] = sprintf('Você conversa com %s (@%s).', $actor->display_name, $actor->username);
        $lines[] = 'Responda em Markdown, no idioma em que a pessoa escrever. Seja direto; use listas e títulos só quando ajudarem a ler.';

        if ($persona['search'] || $persona['read']) {
            $lines[] = 'Para perguntas sobre o fórum ou sobre assuntos discutidos nele, consulte o fórum com as ferramentas antes de responder: busque, leia as discussões mais relevantes e baseie a resposta no que foi dito de fato.';
            $lines[] = 'Cite as discussões que usar com links Markdown para os endereços que as ferramentas devolvem, por exemplo [título da discussão](endereço). Nunca invente discussões, postagens, pessoas ou endereços; se o fórum não tiver a resposta, diga isso.';
        }

        if ($webSearch) {
            $lines[] = 'Você pode pesquisar na web. Cite as fontes da web com links.';
        }

        return implode("\n", $lines);
    }
}
