{{-- A busca. `$inline`: só o campo e o botão, sem a faixa nem o título. --}}
<section class="search{{ ($inline ?? false) ? ' search--inline' : '' }}">
  <form action="{{ $page['base'] }}/" method="get" role="search">
    <label for="canela-404-search" @if ($inline ?? false) hidden @endif>{{ $t('search_title') }}</label>
    <div class="field">
      <input id="canela-404-search" type="search" name="q" placeholder="{{ $t('placeholder') }}" @if ($inline ?? false) aria-label="{{ $t('search_title') }}" @endif>
      <svg viewBox="0 0 512 512" aria-hidden="true"><path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/></svg>
    </div>
    <button class="btn" type="submit">{{ $t('search_button') }}</button>
  </form>
</section>
