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

namespace Ramon\Canela\System\Messages;

use Carbon\Carbon;
use Flarum\Extension\ExtensionManager;
use Flarum\Http\UrlGenerator;
use Flarum\Locale\TranslatorInterface;
use Flarum\Messages\Dialog;
use Flarum\Messages\DialogMessage;
use Flarum\Messages\UserDialogState;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\ConnectionInterface;
use Psr\Log\LoggerInterface;
use Ramon\Canela\System\SystemUser;

/**
 * Manda uma mensagem automática do usuário do sistema: uma mensagem privada
 * do flarum/messages, na conversa entre o sistema e a pessoa (a mesma
 * conversa para todas as mensagens, como um "Mensagens do sistema").
 *
 * A conversa é montada direto nos modelos, sem a API: o usuário do sistema
 * não tem sessão nem permissão de enviar. O evento `Created` sai igual ao da
 * API, então a notificação e o e-mail da mensagem nova chegam como sempre.
 *
 * Nada aqui pode derrubar a ação que disparou a mensagem (um cadastro, uma
 * suspensão): uma falha vira um registro no log e a mensagem não sai.
 */
final class MessageSender
{
    public const TABLE = 'canela_system_messages';

    public const SCHEMA = 'canela.system_messages_schema';

    public function __construct(
        private readonly SystemUser $system,
        private readonly SettingsRepositoryInterface $settings,
        private readonly TranslatorInterface $translator,
        private readonly ExtensionManager $extensions,
        private readonly UrlGenerator $url,
        private readonly ConnectionInterface $db,
        private readonly Dispatcher $events,
        private readonly LoggerInterface $log,
    ) {
    }

    /** Há como mandar: o usuário do sistema existe e o flarum/messages está ligado. */
    public function available(): bool
    {
        return $this->system->get() !== null
            && $this->extensions->isEnabled('flarum-messages')
            && class_exists(DialogMessage::class)
            && (bool) $this->settings->get(self::SCHEMA);
    }

    public function enabled(string $type): bool
    {
        $definition = AutoMessages::TYPES[$type] ?? null;

        return $definition !== null && (bool) $this->settings->get(AutoMessages::setting($type), $definition['default']);
    }

    /** Já mandou esta mensagem para a pessoa? */
    public function alreadySent(User $recipient, string $type): bool
    {
        return $this->db->table(self::TABLE)->where('user_id', $recipient->id)->where('type', $type)->exists();
    }

    /**
     * Manda a mensagem `$type` para `$recipient`, se o tipo estiver ligado.
     *
     * @param array<string, string|int|null> $params as variáveis do texto, além das padrão
     */
    public function send(User $recipient, string $type, array $params = []): bool
    {
        if (! isset(AutoMessages::TYPES[$type]) || ! $this->enabled($type) || ! $this->available()) {
            return false;
        }

        $system = $this->system->get();

        if (! $system || $this->system->is($recipient) || $recipient->isGuest()) {
            return false;
        }

        if (AutoMessages::TYPES[$type]['once'] && $this->alreadySent($recipient, $type)) {
            return false;
        }

        return $this->record($system, $recipient, $type, fn () => $this->content($recipient, $type, $params));
    }

    /**
     * Manda uma mensagem personalizada do admin (CustomMessages), uma vez só
     * por pessoa.
     *
     * @param array{id: string, enabled: bool, subject: string, body: string} $entry
     * @param array<string, string|int|null> $params
     */
    public function sendCustom(User $recipient, array $entry, array $params = []): bool
    {
        $type = CustomMessages::type($entry);

        if (! $entry['enabled'] || trim($entry['body']) === '' || ! $this->available()) {
            return false;
        }

        $system = $this->system->get();

        if (! $system || $this->system->is($recipient) || $recipient->isGuest() || $this->alreadySent($recipient, $type)) {
            return false;
        }

        return $this->record($system, $recipient, $type, function () use ($recipient, $entry, $params): string {
            $params = [...$this->defaults($recipient), ...$params];

            return $this->compose(AutoMessages::interpolate($entry['subject'], $params), AutoMessages::interpolate($entry['body'], $params));
        });
    }

    /** Entrega e anota o envio; uma falha só vai para o log. */
    private function record(User $system, User $recipient, string $type, callable $content): bool
    {
        try {
            $message = $this->deliver($system, $recipient, $content());
        } catch (\Throwable $error) {
            $this->log->error(sprintf('[ramon/canela] mensagem automática %s para o usuário %d não enviada: %s', $type, $recipient->id, $error->getMessage()));

            return false;
        }

        $this->db->table(self::TABLE)->insert([
            'user_id' => $recipient->id,
            'type' => $type,
            'dialog_message_id' => $message->id,
            'created_at' => Carbon::now(),
        ]);

        return true;
    }

    private function compose(string $subject, string $body): string
    {
        $subject = trim($subject);
        $body = trim($body);

        return $subject !== '' ? '**'.$subject."**\n\n".$body : $body;
    }

    /**
     * O assunto em negrito na primeira linha (a conversa não tem título, e
     * a primeira linha é a prévia na lista de mensagens) e o texto embaixo.
     *
     * @param array<string, string|int|null> $params
     */
    public function content(User $recipient, string $type, array $params = []): string
    {
        $params = [...$this->defaults($recipient), ...$params];
        $locale = $this->locale($recipient);

        $subject = trim((string) $this->settings->get(AutoMessages::setting($type, 'subject'), ''));
        $body = trim((string) $this->settings->get(AutoMessages::setting($type, 'body'), ''));

        if ($subject === '') {
            $subject = $this->translator->trans(AutoMessages::translationKey($type, 'subject'), [], null, $locale);
        }

        if ($body === '') {
            $body = $this->translator->trans(AutoMessages::translationKey($type, 'body'), [], null, $locale);
        }

        return $this->compose(AutoMessages::interpolate($subject, $params), AutoMessages::interpolate($body, $params));
    }

    /**
     * As variáveis que toda mensagem tem.
     *
     * @return array<string, string>
     */
    public function defaults(User $recipient): array
    {
        $base = rtrim($this->url->to('forum')->base(), '/');
        $name = (string) ($recipient->display_name ?: $recipient->username);

        return [
            'site_name' => (string) $this->settings->get('forum_title', ''),
            'username' => (string) $recipient->username,
            'name' => $name,
            'name_or_username' => $name,
            'base_url' => $base,
            'user_url' => $base.'/u/'.rawurlencode((string) $recipient->username),
            'user_preferences_url' => $base.'/settings',
            'guidelines_url' => $base.'/guidelines',
        ];
    }

    private function locale(User $recipient): ?string
    {
        $locale = $recipient->getPreference('locale') ?: $this->settings->get('default_locale');

        return is_string($locale) && $locale !== '' ? $locale : null;
    }

    /**
     * Grava a mensagem (e a conversa, se for a primeira) numa transação e só
     * depois avisa: como no `DialogMessageResource::created()` do
     * flarum/messages, o `Created` sai com tudo já gravado. Dentro da
     * transação, com a fila assíncrona, o trabalho da notificação podia rodar
     * antes do commit e não achar a mensagem (ou achar a conversa sem ela).
     */
    private function deliver(User $system, User $recipient, string $content): DialogMessage
    {
        $message = $this->db->transaction(function () use ($system, $recipient, $content): DialogMessage {
            $message = new DialogMessage();
            $message->user_id = $system->id;
            $message->setContentAttribute($content, $system);

            // A conversa direta entre os dois (a mesma de sempre, se já existe).
            $dialog = Dialog::for($message, [$system->id, $recipient->id]);
            $members = $dialog->users()->pluck('users.id')->all();
            $joining = array_diff([$system->id, $recipient->id], $members);

            if ($joining) {
                $dialog->users()->attach(array_fill_keys($joining, ['joined_at' => Carbon::now()]));
            }

            $message->dialog()->associate($dialog);
            $message->save();

            // Troca a expressão da numeração (do evento `creating`) pelo número.
            $message->refresh();

            $dialog->setLastMessage($message);

            if (! $dialog->first_message_id) {
                $dialog->setFirstMessage($message);
            }

            $dialog->save();

            // O sistema "leu" a própria mensagem: a conversa não fica como não
            // lida para ele (e não entra em contagem nenhuma).
            $state = $dialog->state($system)->first();

            if ($state instanceof UserDialogState) {
                $state->read($message->id);
                $state->save();
            }

            return $message;
        });

        // A mensagem já está gravada: uma falha num ouvinte (o aviso, o
        // e-mail) não a desfaz, e o envio é anotado — senão a mensagem "uma
        // vez só" sairia de novo.
        try {
            $this->events->dispatch(new DialogMessage\Event\Created($message));
        } catch (\Throwable $error) {
            $this->log->error(sprintf('[ramon/canela] aviso da mensagem automática %d não enviado: %s', $message->id, $error->getMessage()));
        }

        return $message;
    }
}
