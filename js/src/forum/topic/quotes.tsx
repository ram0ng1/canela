/*
 * Citações no jeito do Discourse (aside.quote): o mentions grava uma citação
 * como `<blockquote><p><a class="PostMention">Fulano</a> texto…</p>`, e o
 * Discourse mostra em cima da citação um cabeçalho "avatar Fulano:" com a
 * seta para ir ao post citado. O tema monta esse cabeçalho dentro do próprio
 * blockquote, sobre o HTML já renderizado.
 *
 * Só acrescenta nós DENTRO dos blocos do post (nunca troca um bloco de
 * lugar): o Mithril guarda os nós de topo do m.trust para removê-los quando
 * o conteúdo muda, e um bloco trocado ficaria para trás.
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';

import { t } from '../utils/settings';
import { iconMarkup } from '../icons';

const DONE = 'canelaQuote';

/** O autor do post citado: pelo post, se já carregou; senão, pelo nome exibido. */
function quotedUser(mention: HTMLAnchorElement): User | null {
  const post = app.store.getById<Post>('posts', mention.dataset.id || '');
  const user = post ? post.user() : null;

  if (user) return user;

  const name = (mention.textContent || '').replace(/^@/, '').trim();

  return app.store.all<User>('users').find((candidate) => candidate.displayName() === name) || null;
}

function decorateQuote(quote: HTMLElement): void {
  const first = quote.firstElementChild;

  if (!first || first.tagName !== 'P') return;

  // A menção tem que abrir o parágrafo: no meio do texto ela é só uma menção.
  const leading = Array.from(first.childNodes).find((node) => node.nodeType !== Node.TEXT_NODE || (node.textContent || '').trim() !== '');

  if (!(leading instanceof HTMLAnchorElement) || !leading.classList.contains('PostMention')) return;

  const title = document.createElement('div');
  title.className = 'CanelaQuote-title';

  const user = quotedUser(leading);

  if (user) {
    const avatar = document.createElement('span');
    m.render(avatar, <Avatar user={user} />);
    title.appendChild(avatar.firstElementChild || avatar);
  }

  // A própria menção vai para o cabeçalho: continua com a prévia ao passar o
  // mouse e o clique que leva ao post, que o mentions já ligou nela.
  const name = document.createElement('span');
  name.className = 'CanelaQuote-name';
  name.appendChild(leading);
  name.appendChild(document.createTextNode(':'));
  title.appendChild(name);

  const controls = document.createElement('span');
  controls.className = 'CanelaQuote-controls';

  const back = document.createElement('a');
  back.href = leading.href;
  back.title = t('topic.post.go_to_quoted');
  back.setAttribute('aria-label', back.title);
  back.innerHTML = iconMarkup('fas fa-arrow-up');
  back.addEventListener('click', (event) => {
    // Deixa o clique com o link da menção, que rola até o post sem recarregar.
    event.preventDefault();
    leading.click();
  });
  controls.appendChild(back);
  title.appendChild(controls);

  // Sobra o espaço que separava a menção do texto.
  const rest = first.firstChild;
  if (rest && rest.nodeType === Node.TEXT_NODE) rest.textContent = (rest.textContent || '').replace(/^\s+/, '');

  quote.classList.add('CanelaQuote');
  quote.insertBefore(title, first);
}

export function decorateQuotes(body: HTMLElement, post: Post, replyMarker: string | null): void {
  const html = post.contentHtml() || '';

  // Uma vez por versão do conteúdo: o onupdate roda a cada redesenho do post.
  if ((body as any)[DONE] === html) return;
  (body as any)[DONE] = html;

  body.querySelectorAll<HTMLElement>(':scope > blockquote, :scope > * blockquote').forEach((quote) => {
    if (!quote.classList.contains('CanelaQuote')) decorateQuote(quote);
  });

  if (replyMarker) {
    const first = body.firstElementChild;
    const mention =
      first && first.tagName === 'P' ? first.querySelector<HTMLAnchorElement>(`:scope > a.PostMention[data-id="${replyMarker}"]`) : null;

    if (mention && first!.firstElementChild === mention) mention.classList.add('CanelaReplyMarker');
  }
}
