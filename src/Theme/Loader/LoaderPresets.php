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

namespace Ramon\Canela\Theme\Loader;

/**
 * Os indicadores de carregamento prontos do tema.
 *
 * Todos são de uma cor só: viram máscara no CSS (less/forum/Loader.less), e a
 * cor vem de fora (a primária do tema ou a escolhida no admin). Por isso o
 * preenchimento é preto: na máscara só conta a opacidade. Sem animação (o
 * `prefers-reduced-motion` desliga as animações dentro do SVG), cada um ainda
 * forma um desenho inteiro, e não um quadro solto do meio do movimento.
 *
 * "avocado" e "orbital" são os mesmos do tema avocado
 * (src/Content/CustomLoadingSpinner.php de lá).
 */
final class LoaderPresets
{
    /** O spinner do Flarum, sem troca nenhuma. */
    public const DEFAULT = 'default';

    /** SVG enviado ou colado no admin (`canela.loader_custom`). */
    public const CUSTOM = 'custom';

    public const SVG = [
        'avocado' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><style>.g{transform-origin:100px 100px;animation:r 6s linear infinite forwards}.s{transform-origin:100px 100px;animation:s 6s linear infinite forwards}.tl{transform-origin:50px 50px;animation:d 6s linear infinite forwards}.tr{transform-origin:150px 50px;animation:u 6s linear infinite forwards}.bl{transform-origin:50px 150px;animation:d 6s linear infinite forwards}.br{transform-origin:150px 150px;animation:u 6s linear infinite forwards}@keyframes r{0%,8.33%{transform:rotate(0deg);animation-timing-function:cubic-bezier(.68,-.55,.265,1.55)}23.33%,31.66%{transform:rotate(90deg);animation-timing-function:cubic-bezier(.68,-.55,.265,1.55)}36.66%,45%{transform:rotate(180deg);animation-timing-function:cubic-bezier(.68,-.55,.265,1.55)}50%,58.33%{transform:rotate(270deg);animation-timing-function:cubic-bezier(.68,-.55,.265,1.55)}63.33%,100%{transform:rotate(360deg)}}@keyframes s{0%,8.33%{transform:scale(1);animation-timing-function:cubic-bezier(.68,-.55,.265,1.55)}11.66%,73.33%{transform:scale(.74);animation-timing-function:cubic-bezier(.68,-.55,.265,1.55)}76.66%,100%{transform:scale(1)}}@keyframes d{0%,3.33%{transform:translateY(0)}6.66%,78.33%{transform:translateY(52px)}81.66%,100%{transform:translateY(0)}}@keyframes u{0%,3.33%{transform:translateY(0)}6.66%,78.33%{transform:translateY(-52px)}81.66%,100%{transform:translateY(0)}}</style><g class="g"><g class="s"><rect class="tl" x="5" y="5" width="90" height="90" rx="6"/><rect class="tr" x="105" y="5" width="90" height="90" rx="6" opacity=".75"/><rect class="bl" x="5" y="105" width="90" height="90" rx="6" opacity=".5"/><rect class="br" x="105" y="105" width="90" height="90" rx="6" opacity=".9"/></g></g></svg>',

        'orbital' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><style>rect{animation:2s cubic-bezier(.45,0,.55,1) infinite}.a{animation-name:a}.b{animation-name:b}.c{animation-name:c}.d{animation-name:d}@keyframes a{0%,100%{transform:translate(0,0)}25%{transform:translate(0,50px)}50%{transform:translate(50px,50px)}75%{transform:translate(50px,0)}}@keyframes b{0%,100%{transform:translate(0,0)}25%{transform:translate(-50px,0)}50%{transform:translate(-50px,50px)}75%{transform:translate(0,50px)}}@keyframes c{0%,100%{transform:translate(0,0)}25%{transform:translate(0,-50px)}50%{transform:translate(-50px,-50px)}75%{transform:translate(-50px,0)}}@keyframes d{0%,100%{transform:translate(0,0)}25%{transform:translate(50px,0)}50%{transform:translate(50px,-50px)}75%{transform:translate(0,-50px)}}</style><rect class="a" x="0" y="0" width="40" height="40" rx="4"/><rect class="b" x="50" y="0" width="40" height="40" rx="4"/><rect class="c" x="50" y="50" width="40" height="40" rx="4"/><rect class="d" x="0" y="50" width="40" height="40" rx="4"/></svg>',

        // O anel do Discourse (o `.spinner` do Horizon): trilho claro e um arco.
        'ring' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><style>.a{transform-origin:25px 25px;animation:r .9s linear infinite}@keyframes r{to{transform:rotate(360deg)}}</style><circle cx="25" cy="25" r="20" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="5"/><path class="a" d="M25 5a20 20 0 0 1 20 20" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round"/></svg>',

        'dots' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>circle{transform-box:fill-box;transform-origin:center;animation:d 1.2s ease-in-out infinite}.b{animation-delay:.15s}.c{animation-delay:.3s}@keyframes d{0%,80%,100%{transform:scale(.55);opacity:.35}40%{transform:scale(1);opacity:1}}</style><circle cx="18" cy="50" r="12"/><circle class="b" cx="50" cy="50" r="12"/><circle class="c" cx="82" cy="50" r="12"/></svg>',

        'bars' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>rect{transform-box:fill-box;transform-origin:center;animation:b 1s ease-in-out infinite}.b{animation-delay:.12s}.c{animation-delay:.24s}.d{animation-delay:.36s}@keyframes b{0%,100%{transform:scaleY(.4);opacity:.5}50%{transform:scaleY(1);opacity:1}}</style><rect x="12" y="18" width="14" height="64" rx="7"/><rect class="b" x="34" y="18" width="14" height="64" rx="7"/><rect class="c" x="56" y="18" width="14" height="64" rx="7"/><rect class="d" x="78" y="18" width="14" height="64" rx="7"/></svg>',

        'pulse' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>circle{transform-origin:50px 50px;animation:p 1.6s cubic-bezier(.2,.6,.4,1) infinite}.b{animation-delay:-.8s}@keyframes p{0%{transform:scale(.1);opacity:1}100%{transform:scale(1);opacity:0}}</style><circle cx="50" cy="50" r="44" fill="none" stroke="#000" stroke-width="8"/><circle class="b" cx="50" cy="50" r="44" fill="none" stroke="#000" stroke-width="8"/></svg>',
    ];

    /** Os estilos que o admin aceita, na ordem em que aparecem. */
    public static function keys(): array
    {
        return [self::DEFAULT, ...array_keys(self::SVG), self::CUSTOM];
    }
}
