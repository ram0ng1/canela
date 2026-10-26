<?php

declare(strict_types=1);

namespace Ramon\Canela\Profile\Api;

use Carbon\Carbon;
use DateTimeInterface;
use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Ramon\Canela\Badges\Badge;
use Ramon\Canela\Badges\BadgeSettings;
use Ramon\Canela\Badges\Capabilities;
use Ramon\Canela\Profile\BioRenderer;
use Ramon\Canela\Profile\ProfileImage;
use Ramon\Canela\Profile\ProfileImageUploader;
use Ramon\Canela\Profile\ProfileSettings;

/**
 * Os campos do perfil estendido no UserResource.
 *
 * Leitura pública (é o que aparece no perfil e no cartão), com três
 * exceções:
 * - o perfil de um suspenso (bio, site, local, status e imagens) só o dono e
 *   a moderação veem (`canelaViewProfile`, ProfilePolicy);
 * - o aniversário não vai para visitantes, e a data completa só o dono e a
 *   moderação veem — os outros membros recebem só dia e mês, a menos que o
 *   usuário escolha mostrar o ano;
 * - imagem por endereço externo só sai com `canela.profile_external_images`
 *   ligado (desligado, a gravação é recusada e o que já estava gravado some).
 *
 * O título, quando o próprio usuário escolhe (sem `edit` sobre ele), só pode
 * ser o nome de um emblema que ele ganhou com "pode virar título" ligado,
 * como no Discourse; a moderação escreve o que quiser.
 *
 * Escrita: o próprio usuário e quem tem `user.edit` (ProfilePolicy). Campo
 * desligado no admin some da API nos dois sentidos.
 *
 * Nada vira HTML aqui sem passar pelo BioRenderer: os textos curtos (local,
 * título, status) saem como texto e o Mithril os escapa no fórum.
 */
final class UserProfileFields
{
    /** Pelo menos um pictograma, bandeira ou tecla; o resto só os modificadores que montam um emoji. */
    public const EMOJI_PATTERN = '/^(?=.*(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\x{20E3}))(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[\x{200D}\x{FE0F}\x{20E3}\x{1F3FB}-\x{1F3FF}#*0-9\x{E0020}-\x{E007F}])+$/u';

    /** Caracteres que quebrariam o `url("…")` da variável CSS onde a imagem é usada. */
    private const CSS_UNSAFE_URL = '/[\s"\'()\\\\<>]/';

    private const BIRTHDAY_SHOW_YEAR = 'canelaBirthdayShowYear';

    /** @var array<int, array{0: ?string, 1: ?string}> a bio renderizada de cada pessoa nesta resposta (texto, html) */
    private array $bios = [];

    /** @var array<string, bool> quem pode ver o perfil de quem nesta resposta ("ator:usuário:suspensão") */
    private array $viewable = [];

    public function __construct(
        private readonly ProfileSettings $settings,
        private readonly BioRenderer $bio,
        private readonly ProfileImageUploader $images,
        private readonly TranslatorInterface $translator,
        private readonly Capabilities $badges,
        private readonly BadgeSettings $badgeSettings,
    ) {
    }

    /** A preferência que guarda se o ano do aniversário é público. */
    public static function birthdayYearPreference(): string
    {
        return self::BIRTHDAY_SHOW_YEAR;
    }

    /**
     * @return array<int, Schema\Attribute>
     */
    public function __invoke(): array
    {
        return [
            ...$this->bioFields(),
            ...$this->textFields(),
            ...$this->statusFields(),
            ...$this->imageFields(),
            ...$this->birthdayFields(),

            Schema\Boolean::make('canelaCanEditProfile')
                ->visible(fn () => $this->settings->enabled())
                ->get(fn (User $user, Context $context) => $context->getActor()->can('canelaEditProfile', $user)),

            Schema\Boolean::make('canelaCanEditTitle')
                ->visible(fn () => $this->settings->fieldEnabled(ProfileSettings::TITLE))
                ->get(fn (User $user, Context $context) => $context->getActor()->can('canelaEditTitle', $user)),
        ];
    }

    /** @return array<int, Schema\Attribute> */
    private function bioFields(): array
    {
        $max = $this->settings->bioMaxLength();

        return [
            // O texto cru só serve para editar (o dono ou quem edita o perfil);
            // o que se mostra é o HTML. Sem isso, cada usuário de cada lista
            // levava a bio duas vezes no payload.
            Schema\Str::make('canelaBio')
                ->property('canela_bio')
                ->visible(fn (User $user, Context $context) => $this->settings->fieldEnabled(ProfileSettings::BIO)
                    && ($context->getActor()->id === $user->id || $context->getActor()->can('canelaEditProfile', $user))
                    && $this->viewable($user, $context))
                ->writable(fn (User $user, Context $context) => $this->canWrite(ProfileSettings::BIO, $user, $context))
                ->nullable()
                ->maxLength($max)
                ->set(function (User $user, ?string $value) {
                    $user->setAttribute('canela_bio', BioRenderer::normalize($value));
                }),

            Schema\Str::make('canelaBioHtml')
                ->visible(fn (User $user, Context $context) => $this->settings->fieldEnabled(ProfileSettings::BIO) && $this->viewable($user, $context))
                ->get(fn (User $user) => $this->bioHtml($user)),
        ];
    }

    /**
     * A bio de cada pessoa é renderizada uma vez por resposta: a mesma pessoa
     * aparece várias vezes numa lista (autora, última a responder, menções).
     */
    private function bioHtml(User $user): ?string
    {
        $text = $user->getAttribute('canela_bio');
        $cached = $this->bios[(int) $user->id] ?? null;

        if ($cached !== null && $cached[0] === $text) {
            return $cached[1];
        }

        $html = $this->bio->render($text);
        $this->bios[(int) $user->id] = [$text, $html];

        return $html;
    }

    /** @return array<int, Schema\Attribute> */
    private function textFields(): array
    {
        return [
            Schema\Str::make('canelaLocation')
                ->property('canela_location')
                ->visible(fn (User $user, Context $context) => $this->settings->fieldEnabled(ProfileSettings::LOCATION) && $this->viewable($user, $context))
                ->writable(fn (User $user, Context $context) => $this->canWrite(ProfileSettings::LOCATION, $user, $context))
                ->nullable()
                ->maxLength(100)
                ->set(fn (User $user, ?string $value) => $user->setAttribute('canela_location', self::singleLine($value))),

            Schema\Str::make('canelaWebsite')
                ->property('canela_website')
                ->visible(fn (User $user, Context $context) => $this->settings->fieldEnabled(ProfileSettings::WEBSITE) && $this->viewable($user, $context))
                ->writable(fn (User $user, Context $context) => $this->canWrite(ProfileSettings::WEBSITE, $user, $context))
                ->nullable()
                ->maxLength(255)
                // `url:http,https` já recusa javascript:, data: e afins; o
                // regex garante o esquema mesmo se a regra do Laravel mudar.
                ->rule('url:http,https')
                ->regex('/^https?:\/\//i')
                ->validationMessages([
                    'canelaWebsite.url' => $this->trans('invalid_website'),
                    'canelaWebsite.regex' => $this->trans('invalid_website'),
                ])
                ->set(fn (User $user, ?string $value) => $user->setAttribute('canela_website', self::singleLine($value))),

            Schema\Str::make('canelaTitle')
                ->property('canela_title')
                ->visible(fn () => $this->settings->fieldEnabled(ProfileSettings::TITLE))
                ->writable(fn (User $user, Context $context) => $context->updating() && $context->getActor()->can('canelaEditTitle', $user))
                ->nullable()
                ->maxLength(60)
                // Quem escolhe o próprio título (sem `edit` sobre o usuário) só
                // usa o nome de um emblema que ganhou e que pode virar título:
                // texto livre deixava qualquer um se chamar "Moderador".
                ->rule(fn (Context $context, mixed $user) => function (string $attribute, mixed $value, \Closure $fail) use ($context, $user): void {
                    $title = is_string($value) ? self::singleLine($value) : null;

                    if ($title === null || ! $user instanceof User || $context->getActor()->can('edit', $user)) {
                        return;
                    }

                    if (! in_array($title, $this->badgeTitles($user), true)) {
                        $fail($this->trans('invalid_title'));
                    }
                })
                ->set(fn (User $user, ?string $value) => $user->setAttribute('canela_title', self::singleLine($value))),
        ];
    }

    /**
     * O status: emoji + frase + "limpar depois de…". O que já
     * venceu sai como nulo — não precisa de tarefa agendada para apagar, e o
     * dado antigo fica até o usuário pôr outro.
     *
     * @return array<int, Schema\Attribute>
     */
    private function statusFields(): array
    {
        $enabled = fn (User $user, Context $context) => $this->settings->fieldEnabled(ProfileSettings::STATUS) && $this->viewable($user, $context);
        $writable = fn (User $user, Context $context) => $this->canWrite(ProfileSettings::STATUS, $user, $context);

        return [
            Schema\Str::make('canelaStatusEmoji')
                ->visible($enabled)
                ->writable($writable)
                ->nullable()
                ->maxLength(16)
                ->regex(self::EMOJI_PATTERN)
                ->validationMessages(['canelaStatusEmoji.regex' => $this->trans('invalid_status_emoji')])
                ->get(fn (User $user) => self::statusActive($user) ? $user->getAttribute('canela_status_emoji') : null)
                ->set(fn (User $user, ?string $value) => $user->setAttribute('canela_status_emoji', self::singleLine($value))),

            Schema\Str::make('canelaStatusText')
                ->visible($enabled)
                ->writable($writable)
                ->nullable()
                ->maxLength(100)
                ->get(fn (User $user) => self::statusActive($user) ? $user->getAttribute('canela_status_text') : null)
                ->set(fn (User $user, ?string $value) => $user->setAttribute('canela_status_text', self::singleLine($value))),

            Schema\DateTime::make('canelaStatusUntil')
                ->visible($enabled)
                ->writable($writable)
                ->nullable()
                ->rule('after:now')
                ->validationMessages(['canelaStatusUntil.after' => $this->trans('invalid_status_until')])
                ->get(fn (User $user) => self::statusActive($user) ? $user->getAttribute('canela_status_until') : null)
                ->set(function (User $user, ?DateTimeInterface $value) {
                    $user->setAttribute('canela_status_until', $value ? Carbon::instance($value)->utc() : null);
                }),
        ];
    }

    /** @return array<int, Schema\Attribute> */
    private function imageFields(): array
    {
        return array_map(fn (ProfileImage $kind) => Schema\Str::make($kind->attribute())
            ->visible(fn (User $user, Context $context) => $this->settings->fieldEnabled(ProfileSettings::COVER) && $this->viewable($user, $context))
            ->writable(fn (User $user, Context $context) => $this->canWrite(ProfileSettings::COVER, $user, $context))
            ->nullable()
            ->maxLength(255)
            // Só https: a imagem entra numa página https, e uma http viraria
            // conteúdo misto (bloqueado ou com aviso no navegador).
            ->rule('url:https')
            ->rule('not_regex:'.self::CSS_UNSAFE_URL)
            // Endereço de outro site só com a opção ligada no admin; a URL do
            // arquivo já enviado (que o fórum devolve e o formulário reenvia)
            // continua valendo.
            ->rule(fn (Context $context, mixed $user) => function (string $attribute, mixed $value, \Closure $fail) use ($user, $kind): void {
                $url = is_string($value) ? self::singleLine($value) : null;

                if ($url === null || $this->settings->externalImagesAllowed()) {
                    return;
                }

                $stored = $user instanceof User ? $user->getAttribute($kind->column()) : null;

                if (is_string($stored) && ! ProfileImageUploader::isExternal($stored) && $url === $this->images->url($stored)) {
                    return;
                }

                $fail($this->trans('external_image_disabled'));
            })
            ->validationMessages([
                $kind->attribute().'.url' => $this->trans('invalid_image_url'),
                $kind->attribute().'.not_regex' => $this->trans('invalid_image_url'),
            ])
            ->get(function (User $user) use ($kind): ?string {
                $stored = $user->getAttribute($kind->column());

                // Gravada antes de o admin desligar os endereços externos: não sai mais.
                if (is_string($stored) && ProfileImageUploader::isExternal($stored) && ! $this->settings->externalImagesAllowed()) {
                    return null;
                }

                return $this->images->url($stored);
            })
            ->set(function (User $user, ?string $value) use ($kind) {
                $value = self::singleLine($value);

                // O fórum devolve a URL pública do arquivo enviado; regravá-la
                // como "externa" perderia o vínculo com o arquivo no disco.
                if ($value !== null && $value === $this->images->url($user->getAttribute($kind->column()))) {
                    return;
                }

                $this->images->setExternal($user, $kind, $value);
            }), ProfileImage::cases());
    }

    /** @return array<int, Schema\Attribute> */
    private function birthdayFields(): array
    {
        $enabled = fn () => $this->settings->fieldEnabled(ProfileSettings::BIRTHDAY);
        $private = fn (User $user, Context $context) => $enabled() && $this->isOwnerOrEditor($user, $context);
        $writable = fn (User $user, Context $context) => $this->canWrite(ProfileSettings::BIRTHDAY, $user, $context);

        return [
            // Para os membros: "MM-DD", ou "AAAA-MM-DD" se o usuário mostrar o
            // ano. Visitante não recebe: dia e mês de nascimento ajudam a
            // descobrir a data completa de alguém, e não servem a quem não participa.
            Schema\Str::make('canelaBirthday')
                ->visible(fn (User $user, Context $context) => $enabled() && ! $context->getActor()->isGuest())
                ->get(function (User $user): ?string {
                    $date = $user->getAttribute('canela_birthday');

                    if (! $date instanceof DateTimeInterface) {
                        return null;
                    }

                    return $user->getPreference(self::BIRTHDAY_SHOW_YEAR) ? $date->format('Y-m-d') : $date->format('m-d');
                }),

            Schema\Date::make('canelaBirthdayDate')
                ->property('canela_birthday')
                ->visible($private)
                ->writable($writable)
                ->nullable()
                ->rule('before:today')
                ->rule('after_or_equal:1900-01-01')
                ->validationMessages([
                    'canelaBirthdayDate.before' => $this->trans('invalid_birthday'),
                    'canelaBirthdayDate.after_or_equal' => $this->trans('invalid_birthday'),
                ])
                ->set(function (User $user, ?DateTimeInterface $value) {
                    $user->setAttribute('canela_birthday', $value ? Carbon::instance($value)->startOfDay() : null);
                }),

            Schema\Boolean::make('canelaBirthdayShowYear')
                ->visible($private)
                ->writable($writable)
                ->get(fn (User $user) => (bool) $user->getPreference(self::BIRTHDAY_SHOW_YEAR))
                ->set(fn (User $user, bool $value) => $user->setPreference(self::BIRTHDAY_SHOW_YEAR, $value)),
        ];
    }

    private function canWrite(string $field, User $user, Context $context): bool
    {
        // Só na edição: o cadastro não pede nada disso, e o Create do core
        // validaria estes campos contra um usuário que ainda não existe.
        return $context->updating()
            && $this->settings->fieldEnabled($field)
            && $context->getActor()->can('canelaEditProfile', $user);
    }

    /** `canelaViewProfile` (ProfilePolicy), uma vez por pessoa nesta resposta. */
    private function viewable(User $user, Context $context): bool
    {
        $actor = $context->getActor();
        $key = $actor->id.':'.$user->id.':'.(string) $user->getAttribute('suspended_until');

        return $this->viewable[$key] ??= $actor->can('canelaViewProfile', $user);
    }

    /**
     * Os títulos que a pessoa pode escolher sozinha: o nome de cada emblema
     * ligado, que ela ganhou, com "pode virar título". Vale o nome gravado e
     * o traduzido (os emblemas do sistema aparecem no idioma de quem lê).
     *
     * @return list<string>
     */
    private function badgeTitles(User $user): array
    {
        if (! $this->badgeSettings->badgesEnabled() || ! $this->badges->installed() || ! $this->badges->adminColumns()) {
            return [];
        }

        $titles = [];

        $badges = Badge::query()
            ->where('enabled', true)
            ->where('allow_title', true)
            ->whereHas('userBadges', fn ($query) => $query->where('user_id', $user->id))
            ->get();

        foreach ($badges as $badge) {
            $titles[] = (string) self::singleLine($badge->name);
            $titles[] = (string) self::singleLine($badge->translated($this->translator, 'name'));
        }

        return array_values(array_unique(array_filter($titles)));
    }

    private function isOwnerOrEditor(User $user, Context $context): bool
    {
        $actor = $context->getActor();

        return $actor->id === $user->id || $actor->can('edit', $user);
    }

    private static function statusActive(User $user): bool
    {
        $until = $user->getAttribute('canela_status_until');

        return $until === null || Carbon::parse($until)->isFuture();
    }

    /** Uma linha só, sem controles nem espaços nas pontas; vazio vira nulo. */
    private static function singleLine(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = (string) preg_replace(BioRenderer::CONTROL_PATTERN, '', str_replace(["\r", "\n", "\t"], ' ', $value));
        $value = trim((string) preg_replace('/ {2,}/', ' ', $value));

        return $value === '' ? null : $value;
    }

    private function trans(string $key): string
    {
        return $this->translator->trans('ramon-canela.api.profile.'.$key);
    }
}
