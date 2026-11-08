{{--
    O content.blade.php do core, com uma diferença: o conteúdo que o servidor
    já monta (a lista de tópicos, os posts de um tópico, as tags) aparece
    antes do JS, em vez de ficar num <noscript>. O primeiro desenho da página
    deixa de esperar o forum.js baixar e rodar; o tema esconde este bloco logo
    antes de o Flarum montar a página (js/src/forum/utils/prerender.ts).
--}}
<div id="flarum-loading" style="display: none">
    {{ $translator->trans('core.views.content.loading_text') }}
</div>

<noscript>
    <div class="Alert">
        <div class="container">
            {{ $translator->trans('core.views.content.javascript_disabled_message') }}
        </div>
    </div>
</noscript>

<div id="flarum-loading-error" style="display: none">
    <div class="Alert">
        <div class="container">
            {{ $translator->trans('core.views.content.load_error_message') }}
        </div>
    </div>
</div>

<div id="flarum-content" class="CanelaPrerender">
    {!! $content !!}
</div>
