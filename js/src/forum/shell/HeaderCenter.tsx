/*
 * O meio do cabeçalho. Como no Discourse, ao rolar um tópico para além do
 * título, a busca dá lugar ao título do tópico com a categoria e as
 * etiquetas embaixo (`.header-title.topic` do Discourse); clicar no título
 * volta ao topo. Fora disso, é a busca.
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import HeaderSearch from './HeaderSearch';
import { forumBool } from '../utils/settings';
import { discussionBadges } from '../utils/tags';

let showingTopic = false;
let frame = 0;

function currentDiscussion(): Discussion | null {
  return app.current.matches(DiscussionPage) ? (app.current.get('discussion') as Discussion | null) : null;
}

/** O título do tópico já saiu da tela por baixo do cabeçalho? */
function titleScrolledAway(): boolean {
  const title = document.querySelector('.DiscussionHero-title');
  const header = document.getElementById('header');

  if (!title || !header) return false;

  return title.getBoundingClientRect().bottom < header.getBoundingClientRect().bottom;
}

function update() {
  frame = 0;

  const next = !!currentDiscussion() && titleScrolledAway();

  if (next !== showingTopic) {
    showingTopic = next;
    m.redraw();
  }
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(update);
}

export function watchHeaderTopic() {
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
}

export default class HeaderCenter extends Component {
  view(): Mithril.Children {
    const discussion = currentDiscussion();

    // Ao trocar de página, o estado é refeito antes de desenhar.
    if (!discussion && showingTopic) showingTopic = false;

    if (discussion && showingTopic) return this.topic(discussion);

    return forumBool('canelaHeaderSearch', true) ? <HeaderSearch state={app.search.state} /> : null;
  }

  onupdate() {
    schedule();
  }

  topic(discussion: Discussion): Mithril.Children {
    const badges = discussion.badges().toArray();

    return (
      <div className="CanelaHeaderTopic">
        <a
          className="CanelaHeaderTopic-title"
          href={app.route.discussion(discussion)}
          onclick={(event: MouseEvent) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;

            event.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          {badges.length > 0 && <span className="CanelaHeaderTopic-status">{badges}</span>}
          <span className="CanelaHeaderTopic-text">{discussion.title()}</span>
        </a>
        <div className="CanelaHeaderTopic-badges">{discussionBadges(discussion)}</div>
      </div>
    );
  }
}
