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

namespace Ramon\Canela\Badges\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;
use Ramon\Canela\Badges\Badge;
use Ramon\Canela\Badges\UserBadge;

/**
 * "Ganhou 'Primeira curtida'" — o `granted_badge` do Discourse.
 *
 * O assunto é o emblema (o que o menu mostra) e a concessão vai nos dados:
 * sem ela, a segunda "Resposta interessante" casaria com a notificação da
 * primeira, e o NotificationSyncer não mandaria nada de novo.
 */
final class BadgeGrantedBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public readonly Badge $badge,
        public readonly UserBadge $userBadge,
    ) {
    }

    #[\Override]
    public function getSubject(): ?AbstractModel
    {
        return $this->badge;
    }

    /**
     * A própria pessoa: no Discourse a notificação de emblema mostra o avatar
     * de quem ganhou, com o selo do emblema no canto.
     */
    #[\Override]
    public function getFromUser(): ?User
    {
        return $this->userBadge->user;
    }

    #[\Override]
    public function getData(): mixed
    {
        return [
            'userBadgeId' => $this->userBadge->id,
            'postId' => $this->userBadge->post_id,
        ];
    }

    #[\Override]
    public static function getType(): string
    {
        return 'canelaBadgeGranted';
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return Badge::class;
    }
}
