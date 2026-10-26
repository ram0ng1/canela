<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\User\User;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;
use Ramon\Canela\MeToo\MeToo;
use Ramon\Canela\Tests\Support\ArraySettings;
use Ramon\Canela\Tests\Support\TestDatabase;

/** "Eu também": liga e desliga por pessoa, e quem não pode não alterna. */
final class MeTooTest extends TestCase
{
    private function meToo(array $settings = [MeToo::ENABLED => '1']): array
    {
        $db = TestDatabase::connection();
        $db->getSchemaBuilder()->create(MeToo::TABLE, static function (Blueprint $table): void {
            $table->unsignedInteger('discussion_id');
            $table->unsignedInteger('user_id');
            $table->dateTime('created_at')->nullable();
            $table->primary(['discussion_id', 'user_id']);
        });

        $extensions = $this->createStub(ExtensionManager::class);
        $extensions->method('isEnabled')->willReturn(false);

        return [new MeToo($db, new ArraySettings($settings), $extensions), $db];
    }

    private function discussion(int $id, ?int $authorId = 1): Discussion
    {
        $discussion = new Discussion();
        $discussion->id = $id;
        $discussion->user_id = $authorId;
        $discussion->is_private = false;
        $discussion->hidden_at = null;

        return $discussion;
    }

    private function user(int $id, bool $confirmed = true): User
    {
        $user = new User();
        $user->id = $id;
        $user->is_email_confirmed = $confirmed;

        return $user;
    }

    public function test_alterna_e_conta_por_pessoa(): void
    {
        [$meToo] = $this->meToo();
        $discussion = $this->discussion(7);

        self::assertSame(['count' => 1, 'mine' => true, 'subscription' => null], $meToo->toggle($discussion, $this->user(2)));
        self::assertSame(['count' => 2, 'mine' => true, 'subscription' => null], $meToo->toggle($discussion, $this->user(3)));
        self::assertSame(['count' => 1, 'mine' => false, 'subscription' => null], $meToo->toggle($discussion, $this->user(2)));
        self::assertSame(['count' => 1, 'mine' => false], $meToo->stateFor($discussion, $this->user(4)));
    }

    public function test_quem_nao_pode_alternar(): void
    {
        [$meToo] = $this->meToo();
        $discussion = $this->discussion(7, authorId: 2);

        // O autor não diz "eu também" ao próprio tópico.
        self::assertFalse($meToo->canToggle($this->user(2), $discussion));
        self::assertFalse($meToo->canToggle($this->user(3, confirmed: false), $discussion));

        $suspended = $this->user(4);
        $suspended->suspended_until = Carbon::now()->addDay();
        self::assertFalse($meToo->canToggle($suspended, $discussion));

        self::assertTrue($meToo->canToggle($this->user(5), $discussion));
        // Tópico de conta apagada: qualquer um pode.
        self::assertTrue($meToo->canToggle($this->user(5), $this->discussion(8, authorId: null)));
    }

    public function test_desligado_ou_topico_privado_nao_mostra(): void
    {
        [$meToo] = $this->meToo([]);
        self::assertFalse($meToo->visibleOn($this->discussion(7)));

        [$meToo] = $this->meToo();
        $private = $this->discussion(7);
        $private->is_private = true;
        self::assertFalse($meToo->visibleOn($private));
    }
}
