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

namespace Ramon\Canela\MeToo;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * O "Me too": no primeiro
 * post de um tópico de suporte, quem tem o mesmo problema diz "Eu também", a
 * contagem aparece no botão e a pessoa passa a acompanhar o tópico para saber
 * da solução.
 *
 * As regras são as do `guardian_extensions.rb` do plugin:
 * - aparece em tópicos públicos (não em mensagens), não ocultos, nas tags
 *   escolhidas no admin, e some quando o tópico tem solução (fof/best-answer),
 *   a menos que o admin peça para manter;
 * - só marca quem está logado, não é o autor, e com o tópico aberto (não
 *   trancado).
 */
final class MeToo
{
    public const TABLE = 'canela_me_too';

    public const ENABLED = 'canela.metoo_enabled';

    /** Ids das tags, separados por vírgula; vazio = todas. */
    public const TAGS = 'canela.metoo_tags';

    public const HIDE_SOLVED = 'canela.metoo_hide_solved';

    public const FOLLOW = 'canela.metoo_follow';

    /** O RateLimiter do plugin: 5 trocas por hora por pessoa por tópico (a equipe não tem limite). */
    public const RATE_LIMIT = 5;

    public const RATE_WINDOW = 3600;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function enabled(): bool
    {
        // Sem o recurso carregado não há o ->default(): get() volta null e o
        // botão some, mesmo com a tabela criada.
        return $this->flag(self::ENABLED);
    }

    /** O botão aparece neste tópico (para qualquer leitor, visitante incluído)? */
    public function visibleOn(Discussion $discussion): bool
    {
        if (! $this->enabled() || $discussion->is_private || $discussion->hidden_at !== null) {
            return false;
        }

        if ($this->flag(self::HIDE_SOLVED) && $this->solved($discussion)) {
            return false;
        }

        return $this->inAllowedTags($discussion);
    }

    /**
     * O `can_create_shared_issue?`: além de visível, quem marca está logado,
     * com o e-mail confirmado, sem suspensão, não é o autor e o tópico não está
     * trancado. Ver o tópico já foi conferido por quem o carregou.
     */
    public function canToggle(User $actor, Discussion $discussion): bool
    {
        if ($actor->isGuest() || ! $actor->is_email_confirmed || (int) $actor->id === (int) $discussion->user_id) {
            return false;
        }

        $suspendedUntil = $actor->getAttribute('suspended_until');

        if ($suspendedUntil !== null && Carbon::parse($suspendedUntil)->isFuture()) {
            return false;
        }

        if ($discussion->getAttribute('is_locked')) {
            return false;
        }

        return $this->visibleOn($discussion);
    }

    /**
     * Contagem e "eu marquei" numa consulta só, pela chave primária.
     *
     * @return array{count: int, mine: bool}
     */
    public function stateFor(Discussion $discussion, User $actor): array
    {
        $userId = $actor->isGuest() ? 0 : (int) $actor->id;

        $row = $this->db->table(self::TABLE)
            ->where('discussion_id', $discussion->id)
            // CASE, não `MAX(user_id = ?)`: no PostgreSQL a comparação é boolean,
            // e não existe MAX(boolean); o CASE dá inteiro em todos os bancos.
            ->selectRaw('COUNT(*) as total, COALESCE(MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END), 0) as mine', [$userId])
            ->first();

        return ['count' => (int) ($row->total ?? 0), 'mine' => (bool) ($row->mine ?? false)];
    }

    /**
     * Marca ou desmarca. Apagar primeiro decide sozinho a direção, sem corrida:
     * se não havia linha, insere (o insertOrIgnore segura dois cliques ao
     * mesmo tempo). Ao marcar, quem não segue o tópico passa a seguir: o
     * `start_tracking_topic` do plugin, que só sobe o nível, nunca desce.
     *
     * @return array{count: int, mine: bool, subscription: string|null}
     */
    public function toggle(Discussion $discussion, User $actor): array
    {
        $mine = $this->db->transaction(function () use ($discussion, $actor): bool {
            $deleted = $this->db->table(self::TABLE)
                ->where('discussion_id', $discussion->id)
                ->where('user_id', $actor->id)
                ->delete();

            if ($deleted > 0) {
                return false;
            }

            $this->db->table(self::TABLE)->insertOrIgnore([
                'discussion_id' => $discussion->id,
                'user_id' => $actor->id,
                'created_at' => Carbon::now(),
            ]);

            return true;
        });

        $subscription = null;

        if ($this->extensions->isEnabled('flarum-subscriptions')) {
            $state = $discussion->stateFor($actor);

            if ($mine && $this->flag(self::FOLLOW) && $state->getAttribute('subscription') !== 'follow') {
                $state->setAttribute('subscription', 'follow');
                $state->save();
            }

            $subscription = $state->getAttribute('subscription');
        }

        return [...$this->stateFor($discussion, $actor), 'subscription' => $subscription];
    }

    private function solved(Discussion $discussion): bool
    {
        return $this->extensions->isEnabled('fof-best-answer') && $discussion->getAttribute('best_answer_post_id') !== null;
    }

    private function inAllowedTags(Discussion $discussion): bool
    {
        $ids = array_values(array_filter(array_map('intval', explode(',', (string) $this->settings->get(self::TAGS, '')))));

        // Sem tags escolhidas (ou sem a extensão de tags) vale em todo tópico.
        if ($ids === [] || ! $this->extensions->isEnabled('flarum-tags')) {
            return true;
        }

        // Um tópico numa tag filha também está na tag pai: escolher a pai
        // cobre as filhas, como uma categoria e as subcategorias.
        if ($discussion->relationLoaded('tags')) {
            return $discussion->getRelation('tags')->contains(static fn ($tag): bool => in_array((int) $tag->id, $ids, true));
        }

        return $this->db->table('discussion_tag')
            ->where('discussion_id', $discussion->id)
            ->whereIn('tag_id', $ids)
            ->exists();
    }

    private function flag(string $key): bool
    {
        return in_array($this->settings->get($key), [true, 1, '1', 'true'], true);
    }
}
