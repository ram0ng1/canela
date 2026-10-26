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

namespace Ramon\Canela\System\Listener;

use Carbon\Carbon;
use Flarum\Group\Group;
use Flarum\Locale\TranslatorInterface;
use Flarum\Post\CommentPost;
use Flarum\Post\Event\Deleting as PostDeleting;
use Flarum\Post\Event\Hidden as PostHidden;
use Flarum\Post\Event\Posted;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Suspend\Event\Suspended;
use Flarum\Suspend\Event\Unsuspended;
use Flarum\User\Event\Activated;
use Flarum\User\Event\GroupsChanged;
use Flarum\User\Event\Registered;
use Flarum\User\User;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Ramon\Canela\Badges\BadgeAwarded;
use Ramon\Canela\Badges\TrustLevel\TrustLevel;
use Ramon\Canela\Badges\TrustLevel\TrustLevelChanged;
use Ramon\Canela\Support\SchemaCache;
use Ramon\Canela\System\Messages\AutoMessages;
use Ramon\Canela\System\Messages\CustomMessages;
use Ramon\Canela\System\Messages\MessageSender;

/**
 * Quando cada mensagem automática sai:
 *
 * - boas-vindas: ao ativar a conta (ou no cadastro já ativado, por OAuth ou
 *   pelo admin); `welcome_invite` no lugar de `welcome_user` para quem
 *   resgatou um convite. Uma das duas, uma vez só;
 * - nível de confiança 1 e 2: na promoção;
 * - equipe e grupos: ao entrar no grupo Admin ou Moderadores (ou em outro);
 * - post denunciado: quando a equipe oculta ou apaga um post com denúncias
 *   da comunidade (flarum/flags);
 * - suspensão: ao suspender e ao tirar a suspensão (flarum/suspend);
 * - as personalizadas do admin (CustomMessages): conta ativada, grupo, nível
 *   de confiança, emblema e primeira postagem (a primeira visível: um post
 *   retido pelo flarum/approval conta quando é aprovado). As de "N dias
 *   depois do cadastro" saem pelo agendador (SendDelayedMessages).
 *
 * Os eventos das extensões opcionais (flarum/flags e flarum/suspend) só são
 * ouvidos com a classe presente, e pelo nome: o tema não depende delas. As
 * denúncias são lidas direto da tabela `flags`.
 */
final class SendAutoMessages
{
    /** O texto do post copiado na mensagem, até este tamanho. */
    private const POST_EXCERPT = 2000;

    public function __construct(
        private readonly MessageSender $sender,
        private readonly SettingsRepositoryInterface $settings,
        private readonly TranslatorInterface $translator,
        private readonly ConnectionInterface $db,
        private readonly SchemaCache $schema,
        private readonly CustomMessages $customs,
    ) {
    }

    public function subscribe(Dispatcher $events): void
    {
        // Ouvintes sem retorno: no dispatcher do Illuminate, um ouvinte que
        // devolve `false` para a propagação, e os ouvintes seguintes do
        // mesmo evento (de outras extensões) não rodariam.
        $events->listen(Registered::class, function (Registered $event): void {
            if ($event->user->is_email_confirmed) {
                $this->activated($event->user);
            }
        });
        $events->listen(Activated::class, function (Activated $event): void {
            $this->activated($event->user);
        });
        $events->listen(GroupsChanged::class, $this->groupsChanged(...));
        $events->listen(TrustLevelChanged::class, $this->trustLevelChanged(...));
        $events->listen(BadgeAwarded::class, function (BadgeAwarded $event): void {
            $this->custom($event->user, 'badge', (int) $event->badge->id, [
                'badge_name' => (string) ($event->badge->translated($this->translator, 'name') ?? $event->badge->name),
            ]);
        });
        $events->listen(Posted::class, $this->posted(...));
    }

    /*
     * Os eventos das extensões opcionais (flarum/flags, flarum/suspend,
     * ramon/verified) são ligados no extend/system.php, pelo Conditional:
     * só existem com a extensão habilitada.
     */

    /** O post denunciado foi ocultado pela moderação (flarum/flags). */
    public function postHidden(PostHidden $event): void
    {
        $this->flaggedPostRemoved($event->post, $event->actor);
    }

    /** Apagado depois de oculto já recebeu a mensagem quando foi ocultado. */
    public function postDeleting(PostDeleting $event): void
    {
        if ($event->post->hidden_at === null) {
            $this->flaggedPostRemoved($event->post, $event->actor);
        }
    }

    /** A conta verificada pela equipe (ramon/verified). */
    public function userVerified(object $event): void
    {
        if (isset($event->user) && $event->user instanceof User) {
            $this->custom($event->user, 'verified');
        }
    }

    /** A conta foi suspensa (flarum/suspend). */
    public function userSuspended(Suspended $event): void
    {
        $this->suspended($event->user);
    }

    /** A suspensão acabou antes do prazo (flarum/suspend). */
    public function userUnsuspended(Unsuspended $event): void
    {
        $this->sender->send($event->user, AutoMessages::UNSUSPENDED);
    }

    /** A conta ficou ativa: as boas-vindas e as personalizadas "na hora". */
    public function activated(User $user): void
    {
        $this->welcome($user);
        $this->custom($user, 'activated');
    }

    public function welcome(User $user): bool
    {
        if ($this->sender->alreadySent($user, AutoMessages::WELCOME_USER) || $this->sender->alreadySent($user, AutoMessages::WELCOME_INVITE)) {
            return false;
        }

        return $this->sender->send($user, $this->invited($user) ? AutoMessages::WELCOME_INVITE : AutoMessages::WELCOME_USER);
    }

    public function groupsChanged(GroupsChanged $event): void
    {
        $user = $event->user;
        $old = collect($event->oldGroups)->map(fn (Group $group) => (int) $group->id)->all();
        $added = $user->groups()->get()->filter(fn (Group $group) => ! in_array((int) $group->id, $old, true));

        foreach ($added as $group) {
            $id = (int) $group->id;

            $this->custom($user, 'group', $id, [
                'group_name' => (string) $group->name_plural,
                'group_path' => '/g/'.(Str::slug(Str::ascii((string) $group->name_plural)) ?: $id),
            ]);

            if ($id === Group::ADMINISTRATOR_ID || $id === Group::MODERATOR_ID) {
                $this->sender->send($user, AutoMessages::WELCOME_STAFF, ['role' => (string) $group->name_singular]);
            } elseif ($id !== Group::MEMBER_ID && $id !== Group::GUEST_ID) {
                $this->sender->send($user, AutoMessages::ADDED_TO_GROUP, [
                    'group_name' => (string) $group->name_plural,
                    'group_path' => '/g/'.(Str::slug(Str::ascii((string) $group->name_plural)) ?: $id),
                ]);
            }
        }
    }

    public function trustLevelChanged(TrustLevelChanged $event): void
    {
        if ($event->from < TrustLevel::BASIC && $event->to >= TrustLevel::BASIC) {
            $this->sender->send($event->user, AutoMessages::WELCOME_TL1);
        }

        if ($event->from < TrustLevel::MEMBER && $event->to >= TrustLevel::MEMBER) {
            $this->sender->send($event->user, AutoMessages::TL2_PROMOTION);
        }

        // Personalizadas: cada nível que a pessoa passou nesta promoção.
        for ($level = $event->from + 1; $level <= $event->to; $level++) {
            $this->custom($event->user, 'trust_level', $level);
        }
    }

    /** A primeira postagem de alguém (comentário visível, em discussão ou resposta). */
    public function posted(Posted $event): void
    {
        $this->firstPost($event->post);
    }

    /**
     * O post retido pelo flarum/approval foi aprovado: só agora ele aparece, e
     * pode ser a primeira postagem visível (ligado no extend/system.php).
     */
    public function postApproved(object $event): void
    {
        if (isset($event->post) && $event->post instanceof Post) {
            $this->firstPost($event->post);
        }
    }

    /**
     * A personalizada de "primeira postagem", quando `$post` é o primeiro
     * comentário visível de quem escreveu. Como no fof/gamification e afins,
     * o que não está à vista não conta: o post à espera de aprovação, o
     * oculto e o privado (fof/byobu e afins) — nem para sair agora, nem na
     * contagem. O envio é uma vez só por pessoa (sendCustom).
     */
    public function firstPost(Post $post): void
    {
        $user = $post->user;

        if (! $user || ! $post instanceof CommentPost || ! $this->visible($post) || ! $this->customs->for('first_post')) {
            return;
        }

        // Só interessa saber se há uma ou mais de uma: no máximo duas linhas
        // lidas, e não a contagem de todas as postagens de quem escreve muito.
        $query = $this->db->table('posts')
            ->join('discussions', 'discussions.id', '=', 'posts.discussion_id')
            ->where('posts.user_id', $user->id)
            ->where('posts.type', 'comment')
            ->whereNull('posts.hidden_at')
            ->where('posts.is_private', false)
            ->whereNull('discussions.hidden_at')
            ->where('discussions.is_private', false);

        if ($this->schema->hasColumn('posts', 'is_approved')) {
            $query->where('posts.is_approved', true);
        }

        $count = \count($query->limit(2)->pluck('posts.id')->all());

        if ($count === 1) {
            $this->custom($user, 'first_post', null, ['url' => '/d/'.$post->discussion_id.'/'.$post->number]);
        }
    }

    /**
     * O post está à vista de todos: aprovado (a coluna só existe com o
     * flarum/approval), não oculto, não privado, numa discussão também
     * pública.
     */
    private function visible(Post $post): bool
    {
        $approved = $post->getAttribute('is_approved');

        if ($approved !== null && ! (bool) $approved) {
            return false;
        }

        if ($post->hidden_at !== null || (bool) $post->is_private) {
            return false;
        }

        $discussion = $post->discussion;

        return ! $discussion || ($discussion->hidden_at === null && ! (bool) $discussion->is_private);
    }

    /**
     * As mensagens personalizadas do gatilho (CustomMessages), cada uma uma
     * vez só por pessoa.
     *
     * @param array<string, string|int|null> $params
     */
    public function custom(User $user, string $trigger, ?int $value = null, array $params = []): bool
    {
        $sent = false;

        foreach ($this->customs->for($trigger, $value) as $entry) {
            $sent = $this->sender->sendCustom($user, $entry, $params) || $sent;
        }

        return $sent;
    }

    /**
     * Um post com denúncias saiu do ar pela mão da equipe. Quem ocultou o próprio
     * post não recebe nada.
     *
     * Só contam as denúncias da comunidade (`type = 'user'`, as do
     * flarum/flags): o flarum/approval marca o post à espera de aprovação com
     * uma denúncia `approval`, e antispam (akismet e afins) com a dele — quem
     * teve o post retido ou barrado como spam não foi "denunciado pela
     * comunidade". O texto livre de quem denunciou (`reason_detail`) nunca
     * vai na mensagem: ele pode identificar quem denunciou. Vão só os motivos.
     */
    public function flaggedPostRemoved(Post $post, ?User $actor): bool
    {
        $author = $post->user;

        if (! $author || ($actor && (int) $actor->id === (int) $author->id)) {
            return false;
        }

        /** @var Collection<int, ?string> $flags */
        $flags = $this->db->table('flags')->where('post_id', $post->id)->where('type', 'user')->pluck('reason');

        if ($flags->isEmpty()) {
            return false;
        }

        $locale = $author->getPreference('locale') ?: $this->settings->get('default_locale');
        $reasons = $flags
            ->map(fn (?string $reason) => $this->flagReason($reason, is_string($locale) ? $locale : null))
            ->unique()
            ->map(fn (string $reason) => '- '.$reason)
            ->implode("\n");

        $content = $post instanceof CommentPost ? (string) $post->content : '';

        return $this->sender->send($author, AutoMessages::FLAGS_AGREED, [
            'url' => '/d/'.$post->discussion_id.'/'.$post->number,
            'flag_reason' => $reasons,
            'flagged_post_raw_content' => Str::limit(str_replace('```', "'''", $content), self::POST_EXCERPT),
        ]);
    }

    public function suspended(User $user): bool
    {
        $until = $user->getAttribute('suspended_until');
        $locale = $user->getPreference('locale') ?: $this->settings->get('default_locale');

        // Mais de 50 anos no futuro é como o flarum/suspend marca "para sempre".
        $date = $until instanceof Carbon && $until->diffInYears(Carbon::now(), true) < 50
            ? $until->copy()->locale(is_string($locale) ? str_replace('-', '_', $locale) : 'en')->isoFormat('LL')
            : '—';

        return $this->sender->send($user, AutoMessages::SUSPENDED, [
            'suspended_till' => $date,
            'reason' => trim((string) $user->getAttribute('suspend_message')),
        ]);
    }

    /** Resgatou um convite (Gaps\Invites): ganha as boas-vindas de convidado. */
    private function invited(User $user): bool
    {
        return $this->schema->hasTable('canela_invite_redemptions')
            && $this->db->table('canela_invite_redemptions')->where('user_id', $user->id)->exists();
    }

    /**
     * O nome do motivo no idioma de quem recebe. Sem motivo da lista (o
     * "Outro" do flarum/flags, que só tem o texto livre de quem denunciou),
     * um "Outro" do tema — o texto livre não vai.
     */
    private function flagReason(?string $reason, ?string $locale): string
    {
        if (! $reason || $reason === 'other') {
            return $this->translator->trans(AutoMessages::translationKey(AutoMessages::FLAGS_AGREED, 'reason_other'), [], null, $locale);
        }

        $key = 'flarum-flags.forum.flag_post.reason_'.$reason.'_label';
        $label = $this->translator->trans($key, [], null, $locale);

        return $label === $key ? $reason : $label;
    }
}
