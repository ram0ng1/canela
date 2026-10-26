<?php

declare(strict_types=1);

namespace Ramon\Canela\Profile;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * As chaves do perfil estendido num lugar só.
 *
 * Cada campo tem a própria chave, mas todos dependem da chave-mestra: o admin
 * desliga o recurso inteiro sem perder a escolha de cada campo. A mesma regra
 * vale para a API (campos somem, rotas respondem 404) e para o fórum.
 */
final class ProfileSettings
{
    public const ENABLED = 'canela.profile_enabled';

    public const BIO = 'bio';

    public const LOCATION = 'location';

    public const WEBSITE = 'website';

    public const TITLE = 'title';

    public const STATUS = 'status';

    public const COVER = 'cover';

    public const BIRTHDAY = 'birthday';

    /** Campos que o admin liga e desliga um a um (`canela.profile_<campo>`). */
    public const FIELDS = [self::BIO, self::LOCATION, self::WEBSITE, self::TITLE, self::STATUS, self::COVER, self::BIRTHDAY];

    /** O próprio usuário escolhe o título; desligado, só a moderação define. */
    public const TITLE_SELF = 'canela.profile_title_self';

    /** Envio de imagem para a capa e o fundo do cartão; desligado, só por URL. */
    public const COVER_UPLOAD = 'canela.profile_cover_upload';

    /**
     * Capa e fundo do cartão por endereço externo. Desligado (o padrão), só
     * imagens enviadas ao fórum: uma URL de outro site é carregada pelo
     * navegador de cada visitante do perfil, e serve de pixel de rastreio.
     */
    public const EXTERNAL_IMAGES = 'canela.profile_external_images';

    public const BIO_MAX_LENGTH = 'canela.profile_bio_max_length';

    public const BIO_MAX_LENGTH_DEFAULT = 1000;

    /** Teto do limite da bio: a coluna é TEXT, mas um "sobre mim" de 3 mil caracteres já é um post. */
    public const BIO_MAX_LENGTH_CEILING = 3000;

    public function __construct(
        private readonly SettingsRepositoryInterface $settings
    ) {
    }

    public static function fieldKey(string $field): string
    {
        return 'canela.profile_'.$field;
    }

    public function enabled(): bool
    {
        return $this->bool(self::ENABLED);
    }

    public function fieldEnabled(string $field): bool
    {
        return $this->enabled() && $this->bool(self::fieldKey($field));
    }

    public function titleSelfEditable(): bool
    {
        return $this->bool(self::TITLE_SELF);
    }

    public function coverUploadEnabled(): bool
    {
        return $this->fieldEnabled(self::COVER) && $this->bool(self::COVER_UPLOAD);
    }

    public function externalImagesAllowed(): bool
    {
        return $this->bool(self::EXTERNAL_IMAGES);
    }

    public function bioMaxLength(): int
    {
        $value = (int) $this->settings->get(self::BIO_MAX_LENGTH, self::BIO_MAX_LENGTH_DEFAULT);

        // Um campo apagado no admin vira 0; zero não é um limite, é engano.
        if ($value <= 0) {
            return self::BIO_MAX_LENGTH_DEFAULT;
        }

        return min($value, self::BIO_MAX_LENGTH_CEILING);
    }

    private function bool(string $key): bool
    {
        // O repositório devolve strings ('1', '0', ''), e o default registrado
        // no extender chega como booleano: os dois formatos passam por aqui.
        $value = $this->settings->get($key);

        return $value === true || $value === 1 || $value === '1' || $value === 'true';
    }
}
