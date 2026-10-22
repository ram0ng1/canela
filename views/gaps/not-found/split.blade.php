{{-- Dividido: o texto, a busca e os tópicos recentes à esquerda; o mapa num painel à direita. --}}
<style>
  .split { max-width: 1110px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 3rem; align-items: center; margin-top: 3rem; }
  .split .title { font-size: 2.25rem; line-height: 1.2; }
  .split .subtitle { font-size: 1.1rem; margin-bottom: 1.5rem; }
  .split .search { margin-bottom: 1.25rem; }
  .split .search form { max-width: none; margin: 0; gap: .75rem; }
  .split .panel { background: var(--accent-low); border-radius: 24px; padding: 3rem 2.5rem; }
  .split .topics { justify-content: flex-start; margin-top: 2rem; }
  .split .topics section { padding: 0; max-width: none; flex-basis: 100%; }
  @@media (max-width: 860px) { .split { grid-template-columns: 1fr; gap: 1.5rem; margin-top: 1.5rem; } .split .panel { order: -1; padding: 1.5rem; } .split .panel svg { max-width: 260px; margin: 0 auto; } }
</style>
<main class="split">
  <div>
    <h1 class="title">{{ $t('title') }}</h1>
    <p class="subtitle">{{ $t('hint') }}</p>
    @include('ramon-canela-gaps::not-found.search', ['inline' => true])
    @include('ramon-canela-gaps::not-found.home')
    @include('ramon-canela-gaps::not-found.topics', ['lists' => ['recent'], 'limit' => 4])
  </div>
  <div class="panel illustration">@include('ramon-canela-gaps::not-found.art-map')</div>
</main>
