<?php
// Popula o Flarum de teste com dados mínimos para que /, /tags e /all
// não fiquem vazios. Roda dentro do diretório raiz do Flarum.

declare(strict_types=1);

use Flarum\Discussion\Discussion;
use Flarum\Tags\Tag;
use Flarum\User\User;

// O workflow copia este arquivo para a raiz do Flarum de teste (./seed.php),
// ao lado do site.php: subir o app dá acesso ao Eloquent já configurado.
$site = require __DIR__.'/site.php';
$site->bootApp();

$admin = User::query()->where('username', 'admin')->firstOrFail();

// Tags (cria 3 se a extensão flarum/tags estiver instalada)
if (class_exists(Tag::class)) {
    foreach ([['General', 'general', '#5856D6'], ['Annunci', 'announcements', '#34C759'], ['Bug', 'bug', '#FF3B30']] as $i => [$name, $slug, $color]) {
        // O Tag não libera atribuição em massa: forceFill em vez de firstOrCreate.
        if (! Tag::query()->where('slug', $slug)->exists()) {
            (new Tag())->forceFill(['name' => $name, 'slug' => $slug, 'color' => $color, 'position' => $i])->save();
        }
    }
}

// Discussões (30) com 1 post cada, pela API interna (o mesmo caminho do
// composer: formatter, contadores e o primeiro post).
$api = resolve(Flarum\Api\JsonApi::class);
for ($i = 1; $i <= 30; $i++) {
    $title = sprintf('Discussion %02d: benchmark seed', $i);
    if (Discussion::query()->where('title', $title)->exists()) continue;

    $api->forResource(Flarum\Api\Resource\DiscussionResource::class)
        ->forEndpoint('create')
        ->process([
            'data' => [
                'attributes' => [
                    'title' => $title,
                    'content' => "Conteúdo de teste número $i para benchmark.\n\nlorem ipsum dolor sit amet.",
                ],
                'relationships' => class_exists(Tag::class)
                    ? ['tags' => ['data' => [['type' => 'tags', 'id' => (string) Tag::query()->value('id')]]]]
                    : [],
            ],
        ], options: ['actor' => $admin]);
}

echo "Seed concluído.\n";
