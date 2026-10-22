{{-- Minimalista: o "404" grande, o título, a busca numa linha e o botão; sem tópicos. --}}
<style>
  .minimal { max-width: 640px; min-height: calc(100vh - 65px - 40px); display: flex; flex-direction: column; justify-content: center; text-align: center; }
  .minimal .code { font-size: clamp(6rem, 18vw, 10rem); font-weight: 800; line-height: 1; letter-spacing: -.04em; color: var(--accent); margin: 0 0 1rem; }
  .minimal .code span { color: var(--accent-medium); }
  .minimal .search { margin: 2rem 0 1.25rem; }
  .minimal .search form { max-width: none; }
</style>
<main class="minimal">
  <p class="code" aria-hidden="true">4<span>0</span>4</p>
  <h1 class="title">{{ $t('title') }}</h1>
  <p class="subtitle">{{ $t('hint') }}</p>
  @include('ramon-canela-gaps::not-found.search', ['inline' => true])
  <div>@include('ramon-canela-gaps::not-found.home')</div>
</main>
