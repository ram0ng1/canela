{{--
  A página 404 do Discourse (page-not-found): cabeçalho com o logo, a lupa
  triste com "Oops! Essa página não existe ou é privada." e "Voltar para o
  início", a caixa "Que tal tentar pesquisar?" e as colunas de tópicos
  populares e recentes. Medidas do css-common.css do meta.discourse.org.
--}}
@php
  $t = fn (string $key) => $translator->trans('ramon-canela.views.not_found.'.$key);
@endphp
<!DOCTYPE html>
<html lang="{{ $translator->getLocale() }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>{{ $t('page_title') }} - {{ $page['title'] }}</title>
  <style>
    :root {
      --accent: {{ $page['color'] }};
      --accent-low: color-mix(in srgb, var(--accent) 12%, #fff);
      --text: #222;
      --text-high: #646464;
      --border: #e9e9e9;
      --bg: #fff;
    }
    @@media (prefers-color-scheme: dark) {
      :root {
        --accent-low: color-mix(in srgb, var(--accent) 20%, #111);
        --text: #ddd;
        --text-high: #a8a8a8;
        --border: #333;
        --bg: #111;
      }
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .header { height: 65px; display: flex; align-items: center; padding: 0 max(16px, calc((100vw - 1270px) / 2)); border-bottom: 1px solid var(--border); }
    .header a { color: var(--text); font-size: 22px; font-weight: 700; }
    .header img { max-height: 40px; display: block; }
    .page-not-found { margin: 0 0 40px; padding: 0 16px; }
    .heading { display: flex; align-items: center; justify-content: center; gap: 2rem; margin-top: 30px; }
    .illustration svg { width: clamp(150px, 20vw, 200px); height: auto; }
    .title_wrapper { text-align: center; }
    h1.title { font-size: 1.75rem; line-height: 1.4; margin: 0; }
    .btn-home { display: inline-flex; align-items: center; gap: .5em; margin-top: 1rem; padding: .5em 1.1em; border-radius: 999px; background: var(--accent); color: #fff; font-size: 1.15rem; }
    .btn-home:hover { text-decoration: none; filter: brightness(1.08); }
    .search { margin: 20px 0 0; background: var(--accent-low); border-radius: 16px; padding: 2rem 2rem 2.5rem; }
    .search form { display: flex; gap: 1.5rem; max-width: 600px; margin-inline: auto; flex-wrap: wrap; }
    .search label { flex-basis: 100%; font-size: 1.5rem; font-weight: 700; }
    .search .field { position: relative; flex-grow: 1; }
    .search input { width: 100%; height: 2.5rem; padding: 0 2.5rem 0 .75rem; border: 1px solid #bbb; border-radius: 6px; font: inherit; background: var(--bg); color: var(--text); }
    .search .field svg { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; fill: var(--text); }
    .search button { border: 0; border-radius: 999px; background: var(--accent); color: #fff; font: inherit; padding: 0 1em; cursor: pointer; }
    .topics { display: grid; grid-template-columns: repeat(2, minmax(0, 368px)); justify-content: center; gap: 72px; margin-top: 40px; }
    .topics h2 { font-size: 1.3rem; margin: 0 0 .9rem; padding-bottom: .9rem; border-bottom: 1px solid #bbb; }
    .topics ul { list-style: none; margin: 0; padding: 0; }
    .topics li { margin-bottom: 1rem; line-height: 1.4; }
    .topics .tag { display: flex; align-items: center; gap: .35em; color: var(--text-high); font-size: .875rem; }
    .topics .tag i { width: .6em; height: .6em; border-radius: 2px; background: var(--c, #999); display: inline-block; }
    .more { font-size: .9rem; }
    @@media (max-width: 640px) {
      .heading { flex-direction: column; gap: 1rem; }
      .search { padding: 1.5rem 1.5rem 2rem; }
      .topics { grid-template-columns: 1fr; gap: 24px; }
    }
  </style>
</head>
<body>
  <header class="header">
    <a href="{{ $page['base'] }}">
      @if ($page['logo'])
        <img src="{{ $page['logo'] }}" alt="{{ $page['title'] }}">
      @else
        {{ $page['title'] }}
      @endif
    </a>
  </header>

  <main class="page-not-found">
    <div class="heading">
      <div class="illustration" aria-hidden="true">
        <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
          <circle cx="68" cy="62" r="46" fill="none" stroke="var(--accent)" stroke-width="3" opacity=".55"/>
          <circle cx="68" cy="62" r="38" fill="var(--accent)" opacity=".45"/>
          <circle cx="54" cy="54" r="4" fill="#fff"/>
          <circle cx="82" cy="54" r="4" fill="#fff"/>
          <path d="M52 80 q16 -12 32 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
          <rect x="98" y="96" width="22" height="58" rx="10" transform="rotate(-45 109 125)" fill="var(--accent)" opacity=".75"/>
          <path d="M150 20 q30 20 6 54" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="4 5" opacity=".6"/>
          <text x="128" y="36" font-size="14" fill="var(--accent)" opacity=".7">?</text>
        </svg>
      </div>
      <div class="title_wrapper">
        <h1 class="title">{{ $t('title') }}</h1>
        <a class="btn-home" href="{{ $page['base'] }}">
          <svg width="18" height="18" viewBox="0 0 576 512" fill="currentColor" aria-hidden="true"><path d="M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c0 2.7-.2 5.4-.5 8.1V472c0 22.1-17.9 40-40 40H456c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1H392c-22.1 0-40-17.9-40-40V384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v88c0 22.1-17.9 40-40 40H128.1c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2H104c-22.1 0-40-17.9-40-40V360c0-.9 0-1.9 .1-2.8V287.6H32c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z"/></svg>
          {{ $t('home') }}
        </a>
      </div>
    </div>

    <section class="search">
      <form action="{{ $page['base'] }}/" method="get" role="search">
        <label for="canela-404-search">{{ $t('search_title') }}</label>
        <div class="field">
          <input id="canela-404-search" type="search" name="q" placeholder="{{ $t('placeholder') }}">
          <svg viewBox="0 0 512 512" aria-hidden="true"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>
        </div>
        <button type="submit">{{ $t('search_button') }}</button>
      </form>
    </section>

    @if (count($page['popular']) || count($page['recent']))
      <div class="topics">
        @foreach (['popular' => 'popular_topics', 'recent' => 'recent_topics'] as $list => $label)
          <section>
            <h2>{{ $t($label) }}</h2>
            <ul>
              @foreach ($page[$list] as $topic)
                <li>
                  <a href="{{ $topic['url'] }}">{{ $topic['title'] }}</a>
                  @if ($topic['tag'])
                    <span class="tag"><i style="--c: {{ $topic['color'] ?: '#999' }}"></i>{{ $topic['tag'] }}</span>
                  @endif
                </li>
              @endforeach
            </ul>
            <a class="more" href="{{ $page['base'] }}/{{ $list === 'popular' ? '?sort=top' : '?sort=newest' }}">{{ $t('see_more') }}</a>
          </section>
        @endforeach
      </div>
    @endif
  </main>
</body>
</html>
