/*
 * A linha do tempo do Discourse é o PostStreamScrubber do core com outra
 * roupa: a lógica (arrastar a alça, clicar no trilho, área não lida) é a
 * mesma, e só os rótulos mudam — a data de criação em cima, há quanto tempo
 * foi o último post embaixo e, ao lado da alça, a data do post em que o
 * leitor está ("16 jul"), no lugar de "Post original"/"Agora"/"outubro 2026".
 */
import { extend, override } from 'flarum/common/extend';

import app from 'flarum/forum/app';
import type Post from 'flarum/common/models/Post';

import { topicSettings } from './ui';
import { discussionBadges } from '../utils/tags';
import { formatWith, shortAge } from '../utils/dates';
import { t } from '../utils/settings';

const MINUTE = 60 * 1000;
/** Depois disso o shortAge já devolve uma data ("8 jun"), que não leva "atrás". */
const AGE_LIMIT = 30 * 24 * 60 * MINUTE;

/**
 * O timelineDate do Discourse: "16 jul" no ano corrente, "ago 2014" nos
 * anteriores (sem o dia).
 */
export function timelineDate(date: Date, now = new Date()): string {
  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { month: 'short', year: 'numeric' };

  return formatWith(date, options)
    .replace(/\./g, '')
    .replace(/\sde\s/g, ' ')
    .trim();
}

export default function installTimeline(): void {
  override('flarum/forum/components/PostStreamScrubber', 'firstPostLabel', function (this: any, original: () => unknown) {
    const created: Date | undefined = this.stream?.discussion?.createdAt();

    if (!topicSettings.timeline() || !created) return original();

    return timelineDate(created);
  });

  override('flarum/forum/components/PostStreamScrubber', 'lastPostLabel', function (this: any, original: () => unknown) {
    const discussion = this.stream?.discussion;
    const last: Date | undefined = discussion?.lastPostedAt() || discussion?.createdAt();

    if (!topicSettings.timeline() || !last) return original();

    const diff = Date.now() - last.getTime();

    // "agora" dispensa o "atrás", e datas antigas aparecem como data; o resto
    // vira "4 h atrás", como no Discourse.
    if (diff < MINUTE) return shortAge(last);
    if (diff >= AGE_LIMIT) return timelineDate(last);

    return t('topic.timeline.ago', { age: shortAge(last) });
  });

  // O core escreve ao lado da alça o mês do ÚLTIMO post visível ("outubro
  // 2026"); o Discourse, a data do post do topo da tela. Recalcula depois do
  // core, pelo item em que o índice está.
  extend('flarum/forum/components/PostStream', 'updateScrubber', function (this: any) {
    if (!this.stream) return;

    // Com posts escondidos (o filtro "N postagens no tópico"), o core divide
    // por altura zero e o índice vira NaN: recalcula só com os visíveis.
    if (!Number.isFinite(this.stream.index)) {
      const viewportTop = window.scrollY + (this.getMarginTop?.() || 0);
      const items = Array.from(this.element?.querySelectorAll?.('.PostStream-item[data-index]') || []) as HTMLElement[];
      const first = items.find((item) => item.offsetHeight > 0 && item.getBoundingClientRect().bottom + window.scrollY > viewportTop);

      this.stream.index = first ? Number(first.dataset.index) + 1 : this.stream.count();
      if (!Number.isFinite(this.stream.visible)) this.stream.visible = 1;
    }

    if (!topicSettings.timeline()) return;

    const index = Math.max(0, Math.floor(this.stream.index) - 1);
    const item = this.element?.querySelector?.(`.PostStream-item[data-index="${index}"]`) as HTMLElement | null;
    const time = item?.dataset.time;

    if (time) this.stream.description = timelineDate(new Date(time));
  });

  // O scrubber e o stream ouvem a rolagem cada um com o seu ScrollListener, e
  // o do scrubber pode rodar primeiro no mesmo quadro — aí ele desenha o
  // índice do quadro anterior e, num salto (Home/End, link), fica parado no
  // número velho. Um quadro de atraso garante que o stream já calculou.
  extend('flarum/forum/components/PostStreamScrubber', 'oninit', function (this: any) {
    const listener = this.scrollListener;

    if (!listener || typeof listener.callback !== 'function') return;

    const callback = listener.callback;

    listener.callback = (top: number) => requestAnimationFrame(() => callback(top));
  });

  // O primeiro post sem varrer o store inteiro (isto roda a cada redesenho da
  // linha do tempo): a relação da discussão ou o primeiro id do tópico.
  const firstPostOf = (discussion: any): Post | null => {
    const related = discussion.firstPost?.() as Post | false | undefined;

    if (related) return related;

    const first = app.store.getById<Post>('posts', discussion.postIds?.()[0]);

    return first && first.number() === 1 ? first : null;
  };

  // O começo do post em texto puro (o `contentPlain` analisa o HTML inteiro),
  // guardado enquanto o conteúdo for o mesmo.
  const excerpts = new WeakMap<Post, { html: string; text: string }>();
  const excerptOf = (post: Post): string => {
    const html = post.contentHtml() || '';
    const cached = excerpts.get(post);

    if (cached && cached.html === html) return cached.text;

    const text = (post.contentPlain() || '').trim().slice(0, 400);
    excerpts.set(post, { html, text });

    return text;
  };

  // A folha da linha do tempo no celular (timeline-fullscreen): à esquerda o
  // título, a categoria e o começo do primeiro post; à direita o trilho.
  extend('flarum/forum/components/PostStreamScrubber', 'view', function (this: any, vnode: any) {
    if (!topicSettings.timeline() || !vnode || !Array.isArray(vnode.children)) return;

    const menu = vnode.children.find((child: any) => child && child.attrs && /Dropdown-menu/.test(child.attrs.className || ''));
    const discussion = this.stream?.discussion;

    if (!menu || !discussion || !Array.isArray(menu.children)) return;

    const firstPost = firstPostOf(discussion);
    const author = firstPost ? firstPost.user() : null;
    const excerpt = firstPost ? excerptOf(firstPost) : '';

    menu.children.unshift(
      m('.CanelaTimelineSheet', [
        m('h2.CanelaTimelineSheet-title', discussion.title()),
        m('.CanelaTimelineSheet-badges', discussionBadges(discussion)),
        excerpt
          ? m('.CanelaTimelineSheet-excerpt', [m('span.CanelaTimelineSheet-user', (author ? author.username() : '') + ':'), ' ', excerpt])
          : null,
      ])
    );
  });

  // O botão flutuante do celular mostra o progresso como o fundo tingido
  // que cresce (o .bg do #topic-progress); a fração vai numa variável.
  extend('flarum/forum/components/PostStreamScrubber', 'updateScrubberValues', function (this: any) {
    const count = this.stream?.count?.() || 0;
    const index = Math.max(1, Math.min(count, Math.round(this.stream?.index || 1)));

    this.element?.style?.setProperty('--cn-progress', count ? String(index / count) : '0');

    // Com o post-alvo no topo, o índice fica em 19,9998 por um subpixel e o
    // core (que arredonda para baixo) escreve "19"; o Discourse mostra "20".
    const raw = this.stream?.index || 1;

    if (raw % 1 > 0.98 && Math.ceil(raw) <= count) {
      this.element?.querySelectorAll?.('.Scrubber-index').forEach((el: Element) => (el.textContent = String(Math.ceil(raw))));
    }
  });

  // A aba "1 / 15" do Discourse (.with-topic-progress) fica acima do editor
  // aberto: bottom = --composer-height. O core já mede o editor para o
  // padding do conteúdo; a mesma medida vai para uma variável do tema.
  extend('flarum/forum/components/Composer', 'updateBodyPadding', function (this: any) {
    const position = this.state?.position;
    const open = position && position !== 'hidden' && app.screen() !== 'phone';
    const height = open ? this.element?.offsetHeight || 0 : 0;

    document.documentElement.style.setProperty('--cn-composer-height', `${height}px`);
  });

  // O trilho do Discourse anima a altura com transição de CSS (.15s ease-out)
  // em toda mudança, inclusive ao rolar; o core anima com jQuery só nos
  // saltos. Sem o jQuery, a transição do LESS cuida de tudo.
  override(
    'flarum/forum/components/PostStreamScrubber',
    'updateScrubberValues',
    function (this: any, original: (options?: any) => void, options: any = {}) {
      return original(topicSettings.timeline() ? { ...options, animate: false } : options);
    }
  );
}
