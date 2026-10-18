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

namespace Ramon\Canela\Badges;

use Carbon\Carbon;
use Illuminate\Database\ConnectionInterface;

/**
 * Os emblemas automáticos do núcleo do Discourse que dá para detectar no
 * Flarum, com o tipo, o agrupamento e o ícone do `db/fixtures/006_badges.rb`.
 *
 * Ficaram de fora os que dependem de algo que o Flarum não registra:
 * compartilhamentos e cliques em links (Primeiro compartilhamento, Link
 * famoso…), convites (Promotor, Ativista, Campeão), wiki, Onebox, resposta por
 * e-mail e "Leu as regras".
 *
 * Os nomes e descrições aqui são o texto de reserva gravado no banco; o que o
 * fórum mostra sai da tradução `ramon-canela.api.badges.<slug>`.
 */
final class SystemBadges
{
    public const GROUPINGS = ['getting_started', 'community', 'posting', 'trust_level', 'other'];

    /** Emblema do nível de confiança N (1 a 4). */
    public const TRUST_LEVEL_BADGES = [1 => 'basic_user', 2 => 'member', 3 => 'regular', 4 => 'leader'];

    /**
     * slug => [tipo, agrupamento, ícone, concessão múltipla, nome, descrição].
     *
     * A ordem da lista é a ordem de exibição dentro de cada agrupamento.
     *
     * @var array<string, array{0: string, 1: string, 2: string, 3: bool, 4: string, 5: string}>
     */
    public const DEFINITIONS = [
        // Primeiros passos
        'first_like' => ['bronze', 'getting_started', 'fas fa-heart', false, 'Primeira curtida', 'Curtiu uma postagem'],
        'first_quote' => ['bronze', 'getting_started', 'fas fa-quote-right', false, 'Primeira citação', 'Citou uma postagem'],
        'first_link' => ['bronze', 'getting_started', 'fas fa-link', false, 'Primeiro link', 'Adicionou um link para outra discussão'],
        'first_mention' => ['bronze', 'getting_started', 'fas fa-at', false, 'Primeira menção', 'Mencionou um(a) usuário(a) em uma postagem'],
        'first_emoji' => ['bronze', 'getting_started', 'fas fa-face-smile', false, 'Primeiro emoji', 'Utilizou um emoji em uma postagem'],
        'first_flag' => ['bronze', 'getting_started', 'fas fa-flag', false, 'Primeiro sinalizador', 'Sinalizou uma postagem'],
        'editor' => ['bronze', 'getting_started', 'fas fa-pen', false, 'Editor(a)', 'Primeira edição de postagem'],
        'autobiographer' => ['bronze', 'getting_started', 'fas fa-user-pen', false, 'Autobiógrafo', 'Preencheu informações de perfil'],
        'reader' => ['bronze', 'getting_started', 'fas fa-book-open-reader', false, 'Leitor(a)', 'Leu todas as respostas em uma discussão com mais de 100 respostas'],
        'new_user_of_the_month' => ['bronze', 'getting_started', 'fas fa-medal', false, 'Novo(a) usuário(a) do mês', 'Contribuições notáveis no primeiro mês'],

        // Comunidade
        'welcome' => ['bronze', 'community', 'fas fa-heart', false, 'Boas-vindas', 'Recebeu uma curtida'],
        'anniversary' => ['silver', 'community', 'fas fa-cake-candles', true, 'Aniversário', 'Membro ativo por um ano, postou ao menos uma vez'],
        'appreciated' => ['bronze', 'community', 'fas fa-heart', false, 'Apreciado', 'Recebeu uma curtida em 20 postagens'],
        'respected' => ['silver', 'community', 'fas fa-heart', false, 'Respeitado(a)', 'Recebeu 2 curtidas em 100 postagens'],
        'admired' => ['gold', 'community', 'fas fa-heart', false, 'Admirado(a)', 'Recebeu cinco curtidas em 300 postagens'],
        'thank_you' => ['bronze', 'community', 'fas fa-heart', false, 'Obrigado', 'Teve 20 postagens curtidas e curtiu dez postagens'],
        'gives_back' => ['silver', 'community', 'fas fa-heart', false, 'Retribuidor(a)', 'Curtiu 100 postagens e teve 100 postagens curtidas'],
        'empathetic' => ['gold', 'community', 'fas fa-heart', false, 'Empático(a)', 'Curtiu 1.000 postagens e teve 500 postagens curtidas'],
        'out_of_love' => ['bronze', 'community', 'fas fa-heart', false, 'Por amor', 'Usou o máximo de curtidas no mesmo dia'],
        'higher_love' => ['silver', 'community', 'fas fa-heart', false, 'Amor maior', 'Usou o máximo de curtidas no mesmo dia cinco vezes'],
        'crazy_in_love' => ['gold', 'community', 'fas fa-heart', false, 'Apaixonado(a)', 'Usou o máximo de curtidas no mesmo dia 20 vezes'],
        'enthusiast' => ['bronze', 'community', 'far fa-eye', false, 'Entusiasta', 'Acessou durante dez dias consecutivos'],
        'aficionado' => ['silver', 'community', 'far fa-eye', false, 'Aficionado(a)', 'Acessou durante 100 dias consecutivos'],
        'devotee' => ['gold', 'community', 'far fa-eye', false, 'Devoto(a)', 'Acessou 365 dias consecutivos'],

        // Postando
        'nice_post' => ['bronze', 'posting', 'fas fa-reply', true, 'Resposta interessante', 'Recebeu dez curtidas em uma resposta'],
        'good_post' => ['silver', 'posting', 'fas fa-reply', true, 'Resposta boa', 'Recebeu 25 curtidas em uma resposta'],
        'great_post' => ['gold', 'posting', 'fas fa-reply', true, 'Resposta excelente', 'Recebeu 50 curtidas em uma resposta'],
        'nice_topic' => ['bronze', 'posting', 'fas fa-file-signature', true, 'Discussão interessante', 'Recebeu 10 curtidas em uma discussão'],
        'good_topic' => ['silver', 'posting', 'fas fa-file-signature', true, 'Boa discussão', 'Recebeu 25 curtidas em uma discussão'],
        'great_topic' => ['gold', 'posting', 'fas fa-file-signature', true, 'Discussão excelente', 'Recebeu 50 curtidas em uma discussão'],

        // Nível de confiança
        'basic_user' => ['bronze', 'trust_level', 'fas fa-user', false, 'Básico', 'Concedido uso de todas as funções essenciais da comunidade'],
        'member' => ['bronze', 'trust_level', 'fas fa-user', false, 'Membro', 'Concedido uso de mensagens, mais curtidas e mais confiança'],
        'regular' => ['silver', 'trust_level', 'fas fa-user', false, 'Regular', 'Concedida a confiança de um(a) colaborador(a) constante'],
        'leader' => ['gold', 'trust_level', 'fas fa-user', false, 'Líder', 'Escolhido(a) pela equipe como exemplo para a comunidade'],
    ];

    /**
     * Grava os emblemas do sistema que faltam.
     *
     * Um emblema que já existe não é tocado: nome, descrição, ícone, tipo e o
     * ligado/desligado são escolha do admin, que pode editá-los. E os que o
     * admin removeu (`$skip`, a marca `canela.badges_removed_system`) não
     * voltam — só pelo "Restaurar emblemas do sistema".
     *
     * @param list<string> $skip
     */
    public static function seed(ConnectionInterface $connection, array $skip = []): int
    {
        $schema = $connection->getSchemaBuilder();
        $hasManualGrant = $schema->hasColumn('canela_badges', 'manual_grant');
        $existing = $connection->table('canela_badges')->pluck('slug')->all();
        $position = 0;
        $created = 0;

        foreach (self::DEFINITIONS as $slug => [$type, $grouping, $icon, $multiple, $name, $description]) {
            $position++;

            if (in_array($slug, $existing, true) || in_array($slug, $skip, true)) {
                continue;
            }

            $row = [
                'slug' => $slug,
                'name' => $name,
                'description' => $description,
                'type' => $type,
                'grouping' => $grouping,
                'icon' => $icon,
                'multiple_grant' => $multiple,
                'position' => $position,
                'system' => true,
                'enabled' => true,
                'listable' => true,
                'created_at' => Carbon::now(),
            ];

            // A regra automática é quem concede os do sistema, como no Discourse.
            if ($hasManualGrant) {
                $row['manual_grant'] = false;
            }

            $connection->table('canela_badges')->insert($row);
            $created++;
        }

        return $created;
    }

    /** O texto de reserva gravado na semente (pt-BR): igual a ele, vale a tradução. */
    public static function defaultText(string $slug, string $field): ?string
    {
        $definition = self::DEFINITIONS[$slug] ?? null;

        return match ($field) {
            'name' => $definition[4] ?? null,
            'description' => $definition[5] ?? null,
            default => null,
        };
    }

    public static function isSystem(string $slug): bool
    {
        return isset(self::DEFINITIONS[$slug]);
    }
}
