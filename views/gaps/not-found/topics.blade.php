{{--
  As listas de tópicos: `$lists` diz quais (popular, recent) e `$limit`
  quantos de cada (todos, por padrão).
--}}
@php
  $lists = array_filter($lists ?? ['popular', 'recent'], fn ($list) => count($page[$list]) > 0);
  $labels = ['popular' => 'popular_topics', 'recent' => 'recent_topics'];
  $more = ['popular' => '?sort=top', 'recent' => '?sort=newest'];
@endphp
@if (count($lists))
  <div class="topics">
    @foreach ($lists as $list)
      <section>
        <h2>{{ $t($labels[$list]) }}</h2>
        <ul>
          @foreach (array_slice($page[$list], 0, $limit ?? null) as $topic)
            <li>
              <a href="{{ $topic['url'] }}">{{ $topic['title'] }}</a>
              @if ($topic['tag'])
                <span class="badge"><i style="--c: {{ $topic['color'] ?: '#999' }}"></i>{{ $topic['tag'] }}</span>
              @endif
            </li>
          @endforeach
        </ul>
        <a class="btn btn-ghost" href="{{ $page['base'] }}/{{ $more[$list] }}">{{ $t('see_more') }}&hellip;</a>
      </section>
    @endforeach
  </div>
@endif
