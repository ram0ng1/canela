<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * Editor (composer): seletor de emoji, tópicos semelhantes,
 * #categoria/#etiqueta, rascunhos, "responder como tópico vinculado" e a
 * pré-visualização lado a lado.
 *
 * Tudo é front-end; aqui ficam só as opções do admin. Os rascunhos são
 * guardados pelo fof/drafts (tabela `drafts`, API `/api/drafts`): a antiga
 * tabela `canela_drafts` do tema ficou no banco, sem uso.
 */

use Flarum\Extend;

// O extend.php principal faz `require` deste arquivo no próprio escopo: uma
// variável solta aqui (como $settings) sobrescreveria a dele. Por isso tudo
// fica dentro de uma função.
$composerSettings = (static function (): Extend\Settings {
    $settings = new Extend\Settings();

    // chave => atributo no fórum. Todas ligadas por padrão, e quem não quiser
    // uma delas desliga no card do admin.
    foreach ([
        'canela.composer_enabled' => 'canelaComposerEnabled',
        'canela.composer_emoji' => 'canelaComposerEmoji',
        'canela.composer_similar' => 'canelaComposerSimilar',
        'canela.composer_hashtags' => 'canelaComposerHashtags',
        // Só vale com o fof/drafts habilitado (o front confere a extensão).
        'canela.composer_drafts' => 'canelaComposerDrafts',
        'canela.composer_linked_topic' => 'canelaComposerLinkedTopic',
        'canela.composer_preview' => 'canelaComposerPreview',
    ] as $key => $attributeName) {
        $settings->default($key, true)->serializeToForum($attributeName, $key, 'boolval');
    }

    return $settings;
})();

return [
    // O chunk da lista de emoji (seletor) sai do diretório de chunks que o
    // extend.php já registra para o fórum (js/dist/forum).
    $composerSettings,
];
