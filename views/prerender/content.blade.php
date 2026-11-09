{{--
    O content.blade.php do core, com uma diferença: o conteúdo que o servidor
    já monta (a lista de tópicos, os posts de um tópico, as tags) fica no
    HTML, escondido quando há JS e visível sem ele.
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

{{-- Com JS o bloco fica escondido: mostrado antes do boot, a lista simples
     ("Todas as Discussões") piscava a cada F5 antes da página de verdade.
     Sem JS (e para quem lê o HTML) o conteúdo continua aqui. --}}
<noscript><style>#flarum-content.CanelaPrerender { display: block !important; }</style></noscript>
<div id="flarum-content" class="CanelaPrerender" style="display: none">
    {!! $content !!}
</div>
