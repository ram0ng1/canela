<?php

declare(strict_types=1);

namespace Ramon\Canela\Profile;

/**
 * As duas imagens do perfil: a capa (faixa larga no topo do perfil) e o fundo
 * do cartão de usuário (o popover dos posts).
 *
 * Um enum para que a coluna, o atributo da API, a rota e o tamanho máximo de
 * cada imagem nunca se desencontrem.
 */
enum ProfileImage: string
{
    case Cover = 'cover';
    case CardBackground = 'card-background';

    public function column(): string
    {
        return match ($this) {
            self::Cover => 'canela_cover_url',
            self::CardBackground => 'canela_card_bg_url',
        };
    }

    public function attribute(): string
    {
        return match ($this) {
            self::Cover => 'canelaCoverUrl',
            self::CardBackground => 'canelaCardBackgroundUrl',
        };
    }

    /** Segmento da rota da API: `/users/{id}/canela-<rota>`. */
    public function route(): string
    {
        return 'canela-'.$this->value;
    }

    /**
     * A caixa em que a imagem é reduzida, sem nunca ampliar. A capa ocupa a
     * largura do cartão principal (~1100px) e precisa de folga para telas de
     * alta densidade; o cartão de usuário tem ~400px.
     *
     * @return array{int, int}
     */
    public function bounds(): array
    {
        return match ($this) {
            self::Cover => [2000, 800],
            self::CardBackground => [900, 600],
        };
    }
}
