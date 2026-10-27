<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Ai;

use Carbon\Carbon;
use Flarum\Group\Group;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Ai\Access\SeedAiPermissions;
use Ramon\Canela\Ai\AiSettings;

/**
 * As permissões da IA (`canela.useAi`, `canela.generateAiSummaries`): quem as
 * tem pelo grupo, as exceções (visitante, e-mail não confirmado, suspenso,
 * IA fora do ar) e a migração que as semeou a partir das listas de grupos
 * das configurações antigas.
 *
 * Pessoas, além das da base: 4 com e-mail não confirmado, 5 moderadora, 6
 * suspensa, 7 administradora suspensa.
 */
class AiPermissionsTest extends AbstractAiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $later = Carbon::now()->addDay();

        $this->prepareDatabase([
            User::class => [
                ['id' => 4, 'username' => 'naoconfirmada', 'email' => 'nc@machine.local', 'is_email_confirmed' => 0],
                ['id' => 5, 'username' => 'moderadora', 'email' => 'mod@machine.local', 'is_email_confirmed' => 1],
                ['id' => 6, 'username' => 'suspensa', 'email' => 'sus@machine.local', 'is_email_confirmed' => 1, 'suspended_until' => $later],
                ['id' => 7, 'username' => 'adminsuspensa', 'email' => 'adm@machine.local', 'is_email_confirmed' => 1, 'suspended_until' => $later],
            ],
            'group_user' => [
                ['user_id' => 5, 'group_id' => Group::MODERATOR_ID],
                ['user_id' => 4, 'group_id' => Group::MODERATOR_ID],
                ['user_id' => 7, 'group_id' => Group::ADMINISTRATOR_ID],
            ],
        ]);
    }

    /** O `canelaAi` do fórum para quem vê. */
    private function ai(?int $as): ?array
    {
        $response = $this->send($this->request('GET', '/api', $as ? ['authenticatedAs' => $as] : []));

        return $this->body($response)['data']['attributes']['canelaAi'] ?? null;
    }

    /** A migração já deu as duas ao grupo Membros (o padrão das configurações antigas). */
    #[Test]
    public function membros_tem_as_duas_permissoes_de_saida(): void
    {
        $this->app();

        foreach ([AiSettings::USE_PERMISSION, AiSettings::SUMMARIZE_PERMISSION] as $permission) {
            $this->assertSame([Group::MEMBER_ID], $this->database()->table('group_permission')->where('permission', $permission)->pluck('group_id')->map('intval')->all());
        }

        $this->assertTrue($this->ai(2)['canUse']);
        $this->assertTrue($this->ai(2)['canSummarize']);
    }

    /** Visitante, e-mail não confirmado e suspenso não usam; administrador sempre usa, menos suspenso. */
    #[Test]
    public function excecoes_pela_conta(): void
    {
        $this->assertFalse($this->ai(null)['canUse']);
        $this->assertFalse($this->ai(null)['canSummarize']);
        $this->assertFalse($this->ai(4)['canUse']);
        $this->assertFalse($this->ai(6)['canUse']);
        $this->assertFalse($this->ai(6)['canSummarize']);

        $this->revoke(AiSettings::USE_PERMISSION);
        $this->revoke(AiSettings::SUMMARIZE_PERMISSION);

        $this->assertTrue($this->ai(1)['canUse']);
        $this->assertTrue($this->ai(1)['canSummarize']);
        $this->assertFalse($this->ai(7)['canUse']);
        $this->assertFalse($this->ai(7)['canSummarize']);
    }

    /** A permissão dada só a um grupo vale só para ele, e as duas são independentes. */
    #[Test]
    public function permissao_por_grupo(): void
    {
        $this->revoke(AiSettings::USE_PERMISSION);
        $this->revoke(AiSettings::SUMMARIZE_PERMISSION);
        $this->database()->table('group_permission')->insert(['group_id' => Group::MODERATOR_ID, 'permission' => AiSettings::USE_PERMISSION]);

        $this->assertFalse($this->ai(2)['canUse']);
        $this->assertTrue($this->ai(5)['canUse']);
        $this->assertFalse($this->ai(5)['canSummarize']);
        $this->assertSame([], $this->ai(2)['personas']);
        $this->assertNotSame([], $this->ai(5)['personas']);

        // E-mail não confirmado: as permissões dos grupos não valem (a regra do core).
        $this->assertFalse($this->ai(4)['canUse']);
    }

    /** Resumos desligados: ninguém gera, nem o administrador. IA fora do ar: nada de `canelaAi`. */
    #[Test]
    public function recurso_desligado_vence_a_permissao(): void
    {
        $this->setting(AiSettings::SUMMARY, '0');

        $this->assertTrue($this->ai(2)['canUse']);
        $this->assertFalse($this->ai(2)['canSummarize']);
        $this->assertFalse($this->ai(1)['canSummarize']);
    }

    #[Test]
    public function ia_fora_do_ar_nao_manda_nada(): void
    {
        $this->setting(AiSettings::ENABLED, '0');

        $this->assertNull($this->ai(2));
        $this->assertNull($this->ai(1));
        $this->assertEquals(404, $this->send($this->request('POST', '/api/canela/ai/conversations/reply', ['authenticatedAs' => 1, 'json' => ['message' => 'Oi']]))->getStatusCode());
    }

    /**
     * A migração: cada lista de grupos das configurações vira linhas na
     * `group_permission`, sem Visitantes, sem grupo inexistente e sem
     * duplicar; configuração nunca gravada = Membros; lista vazia = ninguém
     * (só administradores, que já têm tudo). O `down` tira as duas.
     */
    #[Test]
    public function migracao_semeia_a_partir_das_configuracoes(): void
    {
        $db = $this->database();
        $rows = fn (string $permission): array => $db->table('group_permission')->where('permission', $permission)->orderBy('group_id')->pluck('group_id')->map('intval')->all();

        SeedAiPermissions::down($db);
        $this->assertSame([], $rows(AiSettings::USE_PERMISSION));
        $this->assertSame([], $rows(AiSettings::SUMMARIZE_PERMISSION));

        // Nunca gravadas: o padrão de antes, Membros.
        $db->table('settings')->whereIn('key', [AiSettings::ALLOWED_GROUPS, AiSettings::SUMMARY_GROUPS])->delete();
        SeedAiPermissions::up($db);
        $this->assertSame([Group::MEMBER_ID], $rows(AiSettings::USE_PERMISSION));
        $this->assertSame([Group::MEMBER_ID], $rows(AiSettings::SUMMARIZE_PERMISSION));

        // Listas escolhidas no admin, com Visitantes e um grupo que não existe mais.
        SeedAiPermissions::down($db);
        $db->table('settings')->insert([
            ['key' => AiSettings::ALLOWED_GROUPS, 'value' => '4, 2,99,4,1'],
            ['key' => AiSettings::SUMMARY_GROUPS, 'value' => ''],
        ]);
        SeedAiPermissions::up($db);
        SeedAiPermissions::up($db);

        $this->assertSame([Group::ADMINISTRATOR_ID, Group::MODERATOR_ID], $rows(AiSettings::USE_PERMISSION));
        $this->assertSame([], $rows(AiSettings::SUMMARIZE_PERMISSION));

        // As outras permissões não são tocadas.
        $this->assertTrue($db->table('group_permission')->where('permission', 'canela.createInvite')->exists());
    }
}
