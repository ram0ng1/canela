/*
 * Onebox nas postagens (extend/onebox.php): um link do GitHub sozinho numa
 * linha vira o cartão de common/onebox, como no Discourse. Só o link "cru"
 * (o texto é o próprio endereço) e só fora de citações: um link com texto
 * escolhido por quem escreveu continua link.
 *
 * O cartão entra DENTRO do parágrafo do link, e o link fica lá, escondido:
 * o post entra com m.trust, e trocar o parágrafo por outro elemento mudaria
 * a contagem de nós que o Mithril usa para tirar esse HTML numa edição
 * (o mesmo cuidado de gaps/cooked/decorate).
 */
import { extend } from 'flarum/common/extend';
import CommentPost from 'flarum/forum/components/CommentPost';

import { forumBool } from '../../utils/settings';
import { GITHUB_URL } from '../../../common/oneboxUrl';

const DONE = 'canelaOnebox';

/** O pedido e o desenho do cartão, num chunk que só desce quando há um link para ele. */
const loadCards = () => import('./cards');

/** O link sozinho no parágrafo, com o próprio endereço como texto. */
function standaloneLink(paragraph: HTMLElement): HTMLAnchorElement | null {
  if (paragraph.children.length !== 1) return null;

  const anchor = paragraph.firstElementChild;

  if (!(anchor instanceof HTMLAnchorElement)) return null;

  const href = anchor.getAttribute('href') || '';
  const text = (anchor.textContent || '').trim();

  if ((paragraph.textContent || '').trim() !== text || text !== href || !GITHUB_URL.test(href)) return null;

  return anchor;
}

export function decorateOneboxes(body: HTMLElement): void {
  body.querySelectorAll<HTMLElement>(':scope > p').forEach((paragraph) => {
    if (paragraph.dataset[DONE]) return;

    paragraph.dataset[DONE] = '1';

    const anchor = standaloneLink(paragraph);

    if (!anchor) return;

    loadCards()
      .then(({ fetchOnebox, renderOneboxCard }) =>
        fetchOnebox(anchor.getAttribute('href') || '').then((card) => {
          // O post pode ter mudado (edição, tradução) enquanto o pedido ia.
          if (!card || !paragraph.isConnected || paragraph.querySelector('.CanelaOnebox')) return;

          anchor.classList.add('CanelaOnebox-source-link');
          paragraph.classList.add('CanelaOnebox-host');
          paragraph.appendChild(renderOneboxCard(card));
        })
      )
      // Sem o chunk (rede caiu), fica o link.
      .catch(() => {});
  });
}

export default function installOnebox(): void {
  extend(CommentPost.prototype, ['oncreate', 'onupdate'], function (this: any) {
    if (!forumBool('canelaOneboxGithub', true)) return;

    const body = this.element?.querySelector?.('.Post-body') as HTMLElement | null;

    if (body) decorateOneboxes(body);
  });
}
