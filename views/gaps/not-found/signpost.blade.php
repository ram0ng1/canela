{{-- Placa: a placa de direção no centro, o título, a faixa de busca e as duas listas, mais curtas. --}}
<style>
  .signpost { max-width: 900px; text-align: center; }
  .signpost .illustration { width: clamp(200px, 26vw, 280px); margin: 2rem auto .5rem; }
  .signpost .subtitle { margin-bottom: .25rem; }
  .signpost .search { margin-top: 2rem; text-align: left; }
  .signpost .topics { text-align: left; }
</style>
<main class="signpost">
  <div class="illustration">@include('ramon-canela-gaps::not-found.art-signpost')</div>
  <h1 class="title">{{ $t('title') }}</h1>
  <p class="subtitle">{{ $t('hint') }}</p>
  @include('ramon-canela-gaps::not-found.home')
  @include('ramon-canela-gaps::not-found.search')
  @include('ramon-canela-gaps::not-found.topics', ['limit' => 3])
</main>
