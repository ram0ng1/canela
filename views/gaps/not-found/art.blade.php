{{-- A ilustração do modelo, a imagem enviada no admin no lugar dela, ou nada. --}}
@if ($page['art'] === 'theme')
  @include('ramon-canela-gaps::not-found.'.$art)
@elseif ($page['art'] !== 'none')
  <img src="{{ $page['art'] }}" alt="">
@endif
