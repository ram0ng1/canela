{{-- Clássico: a lupa ao lado do título, a faixa de busca e os tópicos populares e recentes. --}}
<style>
  .classic .heading { display: flex; align-items: center; justify-content: center; gap: 2rem; margin-top: 2rem; }
  .classic .illustration { width: clamp(150px, 20vw, 200px); }
  .classic .title-wrapper { text-align: center; }
  .classic .search { margin-top: 20px; }
  @@media (max-width: 640px) { .classic .heading { flex-direction: column; gap: 1rem; } }
</style>
<main class="classic">
  <div class="heading">
    <div class="illustration">@include('ramon-canela-gaps::not-found.art-magnifier')</div>
    <div class="title-wrapper">
      <h1 class="title">{{ $t('title') }}</h1>
      @include('ramon-canela-gaps::not-found.home')
    </div>
  </div>
  @include('ramon-canela-gaps::not-found.search')
  @include('ramon-canela-gaps::not-found.topics')
</main>
