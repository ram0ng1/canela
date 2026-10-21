{{-- A página 404 do tema quando o recurso está ligado (ramon/canela); senão, a do core. --}}
@php
  $canelaNotFound = resolve(\Ramon\Canela\Gaps\NotFound\NotFoundPage::class);
  $canelaPage = $canelaNotFound->enabled() ? $canelaNotFound->data() : null;
@endphp
@if ($canelaPage)
  @include('ramon-canela-gaps::not-found', ['page' => $canelaPage, 'message' => $message])
@else
  @include('ramon-canela-gaps::core-not-found', ['message' => $message])
@endif
