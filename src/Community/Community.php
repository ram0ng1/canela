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

namespace Ramon\Canela\Community;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;

/**
 * As chaves das configurações das páginas de comunidade e as regras de quem
 * pode ver o quê, num lugar só: os controladores da API, o conteúdo das rotas
 * do fórum e o atributo `canelaCanViewDirectory` precisam concordar, senão o
 * link aparece e a página responde 403 (ou o contrário).
 */
final class Community
{
    public const ABOUT_ENABLED = 'canela.about_enabled';
    public const ABOUT_TEXT = 'canela.about_text';
    public const ABOUT_CONTACT_EMAIL = 'canela.about_contact_email';
    public const ABOUT_CONTACT_URL = 'canela.about_contact_url';
    public const ABOUT_SHOW_STAFF = 'canela.about_show_staff';
    public const ABOUT_SHOW_STATS = 'canela.about_show_stats';

    /** As abas "Diretrizes", "Termos de Serviço" e "Política de Privacidade" do Sobre. */
    public const GUIDELINES_ENABLED = 'canela.guidelines_enabled';
    public const GUIDELINES_TEXT = 'canela.guidelines_text';

    /** Com o fof/pages: o id da página que vira as Diretrizes (vazio = o texto acima). */
    public const GUIDELINES_PAGE = 'canela.guidelines_page';
    /** Com o fof/pages: as páginas que viram abas extras da área Sobre (JSON, ver AboutPages). */
    public const ABOUT_PAGES = 'canela.about_pages';
    public const TOS_URL = 'canela.tos_url';
    public const PRIVACY_URL = 'canela.privacy_url';

    public const DIRECTORY_ENABLED = 'canela.directory_enabled';
    public const DIRECTORY_GUESTS = 'canela.directory_guests';

    public const GROUPS_ENABLED = 'canela.groups_enabled';
    public const GROUPS_ACTIVITY = 'canela.groups_activity';
    public const GROUPS_PROFILE_LINKS = 'canela.groups_profile_links';

    public function __construct(
        private readonly SettingsRepositoryInterface $settings
    ) {
    }

    public function enabled(string $key): bool
    {
        return (bool) $this->settings->get($key);
    }

    /** Desligado no admin, a página e a API somem: 404, e não 403. */
    public function assertEnabled(string $key): void
    {
        if (! $this->enabled($key)) {
            throw new RouteNotFoundException();
        }
    }

    /**
     * Listar usuários é a permissão `searchUsers` do core ("Ver a lista de
     * usuários", que o core só dá aos membros). O admin pode abrir o diretório
     * aos visitantes como o Discourse faz por padrão — mas nunca num fórum
     * fechado, em que o visitante nem pode ver o fórum.
     */
    public function canListUsers(User $actor): bool
    {
        if ($actor->can('searchUsers')) {
            return true;
        }

        return $actor->isGuest()
            && $actor->can('viewForum')
            && $this->enabled(self::DIRECTORY_GUESTS);
    }

    public function assertCanListUsers(User $actor): void
    {
        if (! $this->canListUsers($actor)) {
            throw new PermissionDeniedException();
        }
    }
}
