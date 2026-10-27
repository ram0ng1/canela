<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Chat;

use Flarum\Extend;
use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;

/**
 * As permissões do chat (`canela.chat.*`, em Administração → Permissões) e as
 * policies dos canais e mensagens — inclusive estendidas por outra extensão,
 * que é para isso que elas existem.
 */
class PermissionsTest extends AbstractChatTestCase
{
    /** O `canelaChat` do fórum, como o ator o recebe. */
    private function capabilities(int $actor): array
    {
        [$status, $body] = $this->api('GET', '', $actor);

        $this->assertEquals(200, $status, json_encode($body));

        return $body['data']['attributes']['canelaChat'];
    }

    /** Sem grupo nenhum com `canela.chat.use`, só os administradores usam o chat. */
    #[Test]
    public function sem_grupos_so_os_administradores_usam(): void
    {
        $this->grant('canela.chat.use', []);

        [$member] = $this->api('GET', '/chat-channels', 2);
        [$moderator] = $this->api('GET', '/chat-channels', 3);
        [$admin] = $this->api('GET', '/chat-channels', 1);

        $this->assertEquals(403, $member);
        $this->assertEquals(403, $moderator);
        $this->assertEquals(200, $admin);
        $this->assertFalse($this->capabilities(2)['allowed']);
        $this->assertTrue($this->capabilities(1)['allowed']);
    }

    /** Sem `canela.chat.use`, nem abrir um canal: 403 (o canal existe, o chat é que não é para ele). */
    #[Test]
    public function sem_permissao_de_usar_nao_abre_canal(): void
    {
        $this->grant('canela.chat.use', [4]);

        [$member] = $this->api('GET', '/chat-channels/1', 2);
        [$moderator] = $this->api('GET', '/chat-channels/1', 3);

        $this->assertEquals(403, $member);
        $this->assertEquals(200, $moderator);
    }

    /**
     * `canela.chat.moderate` dá a moderação dos canais públicos: apagar a
     * mensagem dos outros, fixar, editar o canal. Tirada dos moderadores, eles
     * perdem tudo isso; dada aos membros, eles ganham.
     */
    #[Test]
    public function moderar_segue_a_permissao(): void
    {
        $id = $this->post(1, 2, 'Do membro');

        $this->grant('canela.chat.moderate', []);

        $this->assertFalse($this->channelFor(1, 3)['canModerate']);
        $this->assertFalse($this->capabilities(3)['canModerate']);

        [$moderatorPin] = $this->api('POST', "/chat-messages/$id/pin", 3);
        [$moderatorEdit] = $this->api('PATCH', '/chat-channels/1', 3, self::document('chat-channels', ['name' => 'Outro']));
        [$moderatorDelete] = $this->api('DELETE', "/chat-messages/$id", 3);

        $this->assertEquals(403, $moderatorPin);
        $this->assertEquals(403, $moderatorEdit);
        $this->assertEquals(403, $moderatorDelete);

        $this->grant('canela.chat.moderate', [3]);

        $this->assertTrue($this->channelFor(1, 2)['canModerate']);
        $this->assertTrue($this->capabilities(2)['canModerate']);

        [$memberPin] = $this->api('POST', "/chat-messages/$id/pin", 2);

        $this->assertEquals(200, $memberPin);
    }

    /** `canela.chat.createChannel` e `canela.chat.directMessage` aparecem no `canelaChat`. */
    #[Test]
    public function capacidades_do_forum_seguem_as_permissoes(): void
    {
        $this->grant('canela.chat.createChannel', [4]);
        $this->grant('canela.chat.directMessage', [4]);

        $member = $this->capabilities(2);
        $moderator = $this->capabilities(3);

        $this->assertFalse($member['canCreateChannel']);
        $this->assertFalse($member['canDirectMessage']);
        $this->assertTrue($moderator['canCreateChannel']);
        $this->assertTrue($moderator['canDirectMessage']);
    }

    /**
     * A permissão dada a Visitantes vale para todo usuário logado, até sem o
     * e-mail confirmado — como a lista de grupos com o 2 valia antes.
     */
    #[Test]
    public function permissao_dos_visitantes_vale_para_quem_nao_confirmou(): void
    {
        $this->prepareDatabase([
            User::class => [
                ['id' => 5, 'username' => 'semconfirmar', 'email' => 'semconfirmar@machine.local', 'password' => 'too-obscure', 'is_email_confirmed' => false],
            ],
        ]);

        [$before] = $this->api('GET', '/chat-channels', 5);

        $this->grant('canela.chat.use', [2, 3]);

        [$after] = $this->api('GET', '/chat-channels', 5);

        $this->assertEquals(403, $before);
        $this->assertEquals(200, $after);
    }

    /** O que o ator pode numa mensagem vem da MessagePolicy, mensagem a mensagem. */
    #[Test]
    public function mensagens_dizem_o_que_o_ator_pode(): void
    {
        $own = $this->post(1, 2, 'Minha');
        $other = $this->post(1, 3, 'Do moderador');

        [, $body] = $this->messages(1, 2);
        $messages = array_column(self::data($body), null, 'id');

        $this->assertTrue($messages[$own]['canEdit']);
        $this->assertTrue($messages[$own]['canDelete']);
        $this->assertFalse($messages[$other]['canEdit']);
        $this->assertFalse($messages[$other]['canDelete']);

        [, $body] = $this->messages(1, 3);
        $messages = array_column(self::data($body), null, 'id');

        // A moderação apaga a dos outros, mas não edita.
        $this->assertFalse($messages[$own]['canEdit']);
        $this->assertTrue($messages[$own]['canDelete']);
    }

    /**
     * Outra extensão pode negar o que a policy do chat permite: com uma policy
     * que esconde o canal 1 do membro comum, abrir, ler e escrever respondem
     * 403.
     */
    #[Test]
    public function outra_policy_nega_o_canal(): void
    {
        $this->extend((new Extend\Policy())->modelPolicy(Channel::class, HidesChannelOne::class));

        [$show] = $this->api('GET', '/chat-channels/1', 2);
        [$read] = $this->messages(1, 2);
        [$write] = $this->sendMessage(1, 2, 'Oi');
        [$moderator] = $this->api('GET', '/chat-channels/1', 3);

        $this->assertEquals(403, $show);
        $this->assertEquals(403, $read);
        $this->assertEquals(403, $write);
        $this->assertEquals(200, $moderator);
    }

    /**
     * E pode permitir o que a do chat nega: o autor que restaura a própria
     * mensagem apagada pela moderação (sem a policy extra, 403 — ver
     * MessagesTest::autor_restaura_so_o_que_ele_mesmo_apagou). Para os outros,
     * nada muda.
     */
    #[Test]
    public function outra_policy_permite_a_mensagem(): void
    {
        $this->extend((new Extend\Policy())->modelPolicy(Message::class, AuthorAlwaysRestores::class));

        $id = $this->post(1, 2, 'Vai e volta');
        $this->api('DELETE', "/chat-messages/$id", 3);

        $this->api('POST', '/chat-channels/1/membership', 4);
        [$outsider] = $this->api('POST', "/chat-messages/$id/restore", 4);
        [$allowed, $body] = $this->api('POST', "/chat-messages/$id/restore", 2);

        // O 4 nem enxerga a apagada.
        $this->assertEquals(404, $outsider);
        $this->assertEquals(200, $allowed, json_encode($body));
        $this->assertNull(self::data($body)['deletedAt']);
    }
}

/** Uma extensão que esconde o canal 1 do usuário 2. */
class HidesChannelOne extends AbstractPolicy
{
    public function view(User $actor, Channel $channel): ?string
    {
        return $channel->id === 1 && $actor->id === 2 ? $this->forceDeny() : null;
    }
}

/** Uma extensão que deixa o autor restaurar a própria mensagem, quem quer que a tenha apagado. */
class AuthorAlwaysRestores extends AbstractPolicy
{
    public function restore(User $actor, Message $message): ?string
    {
        return $message->user_id === $actor->id ? $this->forceAllow() : null;
    }
}
