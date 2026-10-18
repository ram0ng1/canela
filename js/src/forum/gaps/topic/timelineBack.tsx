/*
 * O "Voltar" da linha do tempo do Discourse (.timeline-last-read): quando o
 * leitor sobe para longe do ponto até onde já leu — um salto para o início,
 * um link para um post antigo —, aparece no trilho, na altura desse ponto,
 * o botão que o leva de volta para a última postagem não lida.
 *
 * O botão nasce no view do scrubber e é mostrado ou escondido no
 * updateScrubberValues, que roda a cada rolagem: o view do scrubber não se
 * redesenha ao rolar (o core mexe nos estilos direto no DOM).
 */
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';

import { gaps } from '../settings';
import { t } from '../../utils/settings';

/** Procura, na árvore do view, o vnode com a classe pedida. */
function findByClass(vnode: any, className: string): any {
  if (!vnode || typeof vnode !== 'object') return null;

  if (vnode.attrs && typeof vnode.attrs.className === 'string' && vnode.attrs.className.split(' ').includes(className)) return vnode;

  const children = Array.isArray(vnode.children) ? vnode.children : [];

  for (const child of children) {
    const found = findByClass(child, className);

    if (found) return found;
  }

  return null;
}

/** Até onde o leitor leu, na escala do scrubber (posição no stream, de 1 a N). */
function lastReadIndex(stream: any): number {
  const discussion = stream?.discussion;
  const number = discussion?.lastReadPostNumber?.() || 0;

  if (!number) return 0;

  // O número do post e a posição no stream só diferem quando há posts
  // apagados no meio; com o post carregado, a posição exata.
  const ids: string[] = discussion.postIds?.() || [];
  const posts: any[] = stream.posts?.() || [];
  const loaded = posts.find((post) => post && post.number() === number);

  if (loaded) {
    const index = ids.indexOf(String(loaded.id()));

    if (index !== -1) return index + 1;
  }

  return Math.min(number, stream.count());
}

export default function installTimelineBack(): void {
  extend('flarum/forum/components/PostStreamScrubber', 'view', function (this: any, vnode: any) {
    if (!gaps.timelineBack()) return;

    const scrollbar = findByClass(vnode, 'Scrubber-scrollbar');

    if (!scrollbar || !Array.isArray(scrollbar.children)) return;

    scrollbar.children.push(
      <div className="CanelaTimelineBack" aria-hidden="true">
        <Button
          className="Button Button--primary CanelaTimelineBack-button"
          title={t('gaps.timeline.back_description')}
          onclick={(event: MouseEvent) => {
            // O clique no trilho também moveria a alça: só o botão vale.
            event.stopPropagation();

            const number = this.stream?.discussion?.lastReadPostNumber?.() || 0;

            if (number) this.stream.goToNumber(number);
          }}
        >
          {t('gaps.timeline.back')}
        </Button>
      </div>
    );
  });

  extend('flarum/forum/components/PostStreamScrubber', 'updateScrubberValues', function (this: any) {
    const element: HTMLElement | null = this.element?.querySelector?.('.CanelaTimelineBack') || null;

    if (!element) return;

    const stream = this.stream;
    const total = stream?.count?.() || 0;
    const current = stream?.index || 0;
    const lastRead = lastReadIndex(stream);

    // As mesmas condições do Discourse: longe o bastante (mais de 3 posts),
    // acima do ponto lido, e o ponto não é o fim do tópico.
    const show =
      gaps.timelineBack() &&
      total > 0 &&
      lastRead > 3 &&
      lastRead > current &&
      Math.abs(lastRead - current) > 3 &&
      Math.abs(lastRead - total) > 1 &&
      lastRead !== total;

    const percent = Math.min(100, Math.max(0, ((lastRead - 1) / total) * 100));
    let visible = show;

    // Como o showButton do Discourse: só quando a alça não está em cima do
    // ponto lido (senão o botão cobriria o "11/27" ao lado dela).
    const scrollbar = element.parentElement as HTMLElement | null;
    const handle = scrollbar?.querySelector<HTMLElement>('.Scrubber-handle');

    if (visible && scrollbar && handle) {
      const top = (percent / 100) * scrollbar.clientHeight;
      const handleTop = handle.offsetTop;
      const handleBottom = handleTop + handle.offsetHeight;

      visible = handleBottom + 40 < top || handleTop > top + 40;
    }

    element.classList.toggle('CanelaTimelineBack--visible', visible);
    element.setAttribute('aria-hidden', visible ? 'false' : 'true');

    if (visible) element.style.top = `${percent}%`;
  });
}
