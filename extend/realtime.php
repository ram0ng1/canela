<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * Tempo real também para quem agiu (com o flarum/realtime): a curtida, a
 * reação ou a edição feita numa aba aparece nas outras abas e aparelhos da
 * mesma conta. O realtime avisa todo mundo menos quem fez a ação; aqui o
 * mesmo aviso vai também para o canal privado dessa pessoa (veja
 * Ramon\Canela\Realtime\EchoToActorJob).
 *
 * Fora daqui ficam as respostas novas e os tópicos novos: o aviso deles, na
 * lista, conta como "atividade nova" e mexe no título da aba, e a própria
 * resposta não é novidade para quem a escreveu.
 */

use Flarum\Extend;
use Flarum\Post\Event\Revised;
use Ramon\Canela\Realtime\EchoToActor;

$echo = static fn (string $name, callable $post, callable $actor): Closure => static function (object $event) use ($name, $post, $actor): void {
    resolve(EchoToActor::class)->push($name, $post($event), $actor($event));
};

return [
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-realtime', static fn (): array => [
            (new Extend\Event())
                // O mesmo nome do realtime para a edição (o JS dele recarrega o post).
                ->listen(Revised::class, $echo('revisedEvent', static fn ($e) => $e->post, static fn ($e) => $e->actor)),

            (new Extend\Conditional())
                ->whenExtensionEnabled('flarum-likes', static fn (): array => [
                    (new Extend\Event())
                        ->listen('Flarum\Likes\Event\PostWasLiked', $echo('likesMutation', static fn ($e) => $e->post, static fn ($e) => $e->user))
                        ->listen('Flarum\Likes\Event\PostWasUnliked', $echo('likesMutation', static fn ($e) => $e->post, static fn ($e) => $e->user)),
                ])
                ->whenExtensionEnabled('fof-reactions', static fn (): array => [
                    (new Extend\Event())
                        ->listen('FoF\Reactions\Event\PostWasReacted', $echo('reactionMutation', static fn ($e) => $e->post, static fn ($e) => $e->user))
                        ->listen('FoF\Reactions\Event\PostWasUnreacted', $echo('reactionMutation', static fn ($e) => $e->post, static fn ($e) => $e->user)),
                ]),
        ]),
];
