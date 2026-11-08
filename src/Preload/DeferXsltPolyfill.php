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

namespace Ramon\Canela\Preload;

use Flarum\Formatter\XsltPolyfill;
use Flarum\Frontend\Document;
use Illuminate\Contracts\Filesystem\Factory;

/**
 * O polyfill do XSLT fora do caminho crítico.
 *
 * No navegador sem XSLT nativo (o Chrome atual), o core escreve o polyfill
 * (~520 KB) com document.write no `<head>`: a página inteira espera ele
 * baixar e compilar antes da primeira pintura. O forum.js só precisa que
 * `new XSLTProcessor` exista ao carregar (o s9e prepara o renderizador da
 * prévia); a transformação de verdade só roda quando alguém escreve.
 *
 * Então um substituto mínimo entra antes (no `$preHead`, que vem antes do
 * detector do core, e o detector passa a ver um XSLTProcessor e não escreve
 * nada). Ele guarda as chamadas e, depois do `load`, o polyfill desce sem
 * bloquear; na primeira transformação o substituto cria o processador de
 * verdade e repete as chamadas guardadas.
 */
final class DeferXsltPolyfill
{
    private const SCRIPT = <<<'JS'
(function(u){try{if(typeof XSLTProcessor!=="undefined"&&new XSLTProcessor())return}catch(e){}
function S(){this.q=[]}
["importStylesheet","setParameter","removeParameter","clearParameters"].forEach(function(m){S.prototype[m]=function(){this.q.push([m,arguments]);if(this.r)return this.r[m].apply(this.r,arguments)}});
S.prototype.transformToFragment=function(x,d){var R=window.XSLTProcessor,t=this;if(!t.r&&R!==S){t.r=new R;t.q.forEach(function(c){t.r[c[0]].apply(t.r,c[1])})}return t.r?t.r.transformToFragment(x,d):d.createDocumentFragment()};
window.XSLTProcessor=S;
addEventListener("load",function(){var s=document.createElement("script");s.src=u;document.head.appendChild(s)},{once:true})})(__URL__);
JS;

    public function __invoke(Document $document): void
    {
        if (! class_exists(XsltPolyfill::class) || ($url = XsltPolyfill::publicUrl(resolve(Factory::class))) === null) {
            return;
        }

        $json = json_encode($url, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);

        $document->preHead[] = '<script>'.str_replace(["\n", '__URL__'], ['', (string) $json], self::SCRIPT).'</script>';
    }
}
