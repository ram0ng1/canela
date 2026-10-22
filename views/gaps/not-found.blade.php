{{--
  A página 404 do tema: o cabeçalho com o logo e o modelo escolhido no admin
  (views/gaps/not-found/<modelo>.blade.php). Aqui fica o que é comum a todos:
  a fonte do fórum, as cores (todas tiradas da cor de destaque) e os estilos
  da busca e das listas de tópicos.
--}}
@php
  $t = fn (string $key) => $translator->trans('ramon-canela.views.not_found.'.$key);
  $font = $page['font'];
@endphp
<!DOCTYPE html>
<html lang="{{ $translator->getLocale() }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>{{ $t('page_title') }} - {{ $page['title'] }}</title>
  @if ($font['family'])
    <link rel="preload" href="{{ $font['latin'] }}" as="font" type="font/woff2" crossorigin>
  @endif
  <style>
    @if ($font['family'])
      @@font-face { font-family: '{{ $font['family'] }}'; font-weight: 100 900; font-display: swap; src: url('{{ $font['latin'] }}') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
      @@font-face { font-family: '{{ $font['family'] }}'; font-weight: 100 900; font-display: swap; src: url('{{ $font['latinExt'] }}') format('woff2'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
    @endif
    :root {
      --accent: {{ $page['color'] }};
      /* Os três tons da ilustração e da faixa de busca: forte, médio e claro. */
      --accent-high: color-mix(in srgb, var(--accent) 78%, #fff);
      --accent-medium: color-mix(in srgb, var(--accent) 45%, #fff);
      --accent-low: color-mix(in srgb, var(--accent) 10%, #fff);
      --text: #222;
      --text-high: #646464;
      --border: #e9e9e9;
      --border-strong: #b3b3b3;
      --bg: #fff;
      --font: {!! $font['family'] ? "'".e($font['family'])."', " : '' !!}system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    @@media (prefers-color-scheme: dark) {
      :root {
        --accent-high: color-mix(in srgb, var(--accent) 85%, #fff);
        --accent-medium: color-mix(in srgb, var(--accent) 55%, #111);
        --accent-low: color-mix(in srgb, var(--accent) 18%, #111);
        --text: #ddd;
        --text-high: #a8a8a8;
        --border: #333;
        --border-strong: #555;
        --bg: #111;
      }
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 var(--font); -webkit-font-smoothing: antialiased; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .header { height: 65px; display: flex; align-items: center; padding: 0 max(16px, calc((100vw - 1270px) / 2)); border-bottom: 1px solid var(--border); }
    .header a { color: var(--text); font-size: 1.5rem; font-weight: 700; }
    .header img { max-height: 40px; display: block; }
    main { padding: 0 16px; margin: 0 auto 40px; }
    .title { font-size: 1.75rem; line-height: 1.4; font-weight: 700; margin: 0; }
    .subtitle { color: var(--text-high); margin: .5rem 0 0; }
    .btn { display: inline-flex; align-items: center; gap: .5em; border: 0; border-radius: 999px; background: var(--accent); color: #fff; font: inherit; font-size: 1.15rem; padding: .55em 1.15em; cursor: pointer; }
    .btn:hover { text-decoration: none; filter: brightness(1.08); }
    .btn svg { width: 1em; height: 1em; fill: currentColor; }
    .btn-home { margin-top: 1rem; }
    .btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border-strong); font-size: .95rem; padding: .4em .9em; }
    /* A busca */
    .search { background: var(--accent-low); border-radius: 16px; padding: 2rem 2rem 2.5rem; }
    .search form { display: flex; gap: 1.5rem; max-width: 600px; margin-inline: auto; flex-wrap: wrap; }
    .search label { flex-basis: 100%; font-size: 1.5rem; font-weight: 700; color: var(--text); }
    .search .field { position: relative; flex-grow: 1; }
    .search input { width: 100%; height: 2.5rem; padding: 0 2.5rem 0 .75rem; border: 1px solid var(--border-strong); border-radius: 6px; font: inherit; background: var(--bg); color: var(--text); }
    .search input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: transparent; }
    .search .field svg { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; fill: var(--text); }
    .search .btn { font-size: 1rem; padding: 0 1em; justify-content: center; }
    .search--inline { background: none; padding: 0; }
    .search--inline form { flex-wrap: nowrap; }
    /* As listas de tópicos */
    .topics { display: flex; justify-content: center; column-gap: 2.5rem; margin-top: 40px; }
    .topics section { flex-basis: 50%; max-width: 400px; padding: 1rem; }
    .topics h2 { font-size: 1.3rem; margin: 0 0 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-strong); }
    .topics ul { list-style: none; margin: 0 0 1rem; padding: 0; }
    .topics li { display: flex; flex-wrap: wrap; align-items: baseline; margin-bottom: 15px; }
    .topics li > a { flex-basis: 100%; }
    .badge { display: inline-flex; align-items: center; gap: .35em; color: var(--text-high); font-size: .875rem; }
    .badge i { width: .6em; height: .6em; border-radius: 2px; background: var(--c, #999); display: inline-block; }
    .illustration svg { display: block; width: 100%; height: auto; }
    @@media (max-width: 640px) {
      .search { padding: 1.5rem 1.5rem 2rem; }
      .search form, .search--inline form { flex-direction: column; flex-wrap: wrap; gap: 1rem; }
      .search .btn { min-height: 2.5rem; }
      .topics { flex-direction: column; gap: 1rem; }
      .topics section { padding: 0; max-width: none; }
      .topics li:nth-of-type(n + 6) { display: none; }
    }
  </style>
</head>
<body class="template-{{ $page['template'] }}">
  <header class="header">
    <a href="{{ $page['base'] }}">
      @if ($page['logo'])
        <img src="{{ $page['logo'] }}" alt="{{ $page['title'] }}">
      @else
        {{ $page['title'] }}
      @endif
    </a>
  </header>

  @include('ramon-canela-gaps::not-found.'.$page['template'], ['page' => $page, 't' => $t])
</body>
</html>
