/*
 * "Sua discussão é semelhante a…" — enquanto a pessoa escreve o título de um
 * tópico novo, o tema procura tópicos parecidos e os mostra num balão ao
 * lado do composer, para evitar a pergunta repetida.
 *
 * A busca começa com três palavras ou mais e espera a pessoa parar de digitar.
 * O balão some quando ela o fecha (até o título mudar de novo de verdade) ou
 * quando não há resultados.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import { debounce } from 'flarum/common/utils/throttleDebounce';
import type Discussion from 'flarum/common/models/Discussion';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { composerOn } from './common';
import { discussionBadges } from '../../utils/tags';
import { shortAge, fullDate } from '../../utils/dates';
import { t } from '../../utils/settings';

const MIN_WORDS = 3;
const LIMIT = 5;
const WAIT_MS = 700;

interface SimilarState {
  title: string;
  /** O título da última busca — só busca de novo quando ele muda de verdade. */
  searched: string;
  results: Discussion[];
  dismissedFor: string | null;
  search: (title: string) => void;
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

export default function installSimilarTopics() {
  extend('flarum/forum/components/DiscussionComposer', 'oninit', function (this: any) {
    let request = 0;

    const state: SimilarState = {
      title: '',
      searched: '',
      results: [],
      dismissedFor: null,
      search: debounce(WAIT_MS, (title: string) => {
        const current = ++request;

        app.store
          .find<Discussion[]>('discussions', { filter: { q: title }, page: { limit: LIMIT } } as any, undefined, { errorHandler: () => {} } as any)
          .then((results) => {
            // Uma busca mais nova já saiu: esta resposta chegou atrasada.
            if (current !== request) return;

            state.results = Array.from(results);
            m.redraw();
          })
          .catch(() => {});
      }),
    };

    this.canelaSimilar = state;
  });

  extend('flarum/forum/components/DiscussionComposer', 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
    const state: SimilarState | undefined = this.canelaSimilar;

    if (!state || !composerOn('Similar')) return;

    // O headerItems roda a cada redesenho, e cada tecla no título redesenha:
    // é aqui que a mudança do título é percebida.
    const title = normalizeTitle(this.title?.() || '');

    if (title !== state.title) {
      state.title = title;

      if (title.split(' ').filter(Boolean).length >= MIN_WORDS) {
        if (title !== state.searched) {
          state.searched = title;
          state.search(title);
        }
      } else {
        state.results = [];
        state.searched = '';
      }
    }

    const minimized = app.composer.position === 'minimized';

    if (minimized || !state.results.length || state.dismissedFor === state.searched) return;

    items.add(
      'canelaSimilar',
      <div className="CanelaSimilarTopics" role="region" aria-label={t('composer.similar.title')}>
        <div className="CanelaSimilarTopics-header">
          <h4 className="CanelaSimilarTopics-title">{t('composer.similar.title')}</h4>
          <button
            type="button"
            className="Button Button--icon Button--link CanelaSimilarTopics-close"
            aria-label={t('composer.similar.close')}
            title={t('composer.similar.close')}
            onclick={() => (state.dismissedFor = state.searched)}
          >
            <Icon name="fas fa-xmark" />
          </button>
        </div>
        <ul className="CanelaSimilarTopics-list">
          {state.results.map((discussion) => (
            <li key={discussion.id()}>
              <Link
                className="CanelaSimilarTopics-item"
                href={app.route.discussion(discussion)}
                // O composer fica aberto na troca de página (é do app, não da
                // página); minimizado, a pessoa lê o tópico e volta a ele.
                onclick={() => app.composer.minimize()}
              >
                <span className="CanelaSimilarTopics-itemTitle">{discussion.title()}</span>
                <span className="CanelaSimilarTopics-itemMeta">
                  {discussionBadges(discussion, false)}
                  <span className="CanelaSimilarTopics-itemStats" title={fullDate(discussion.lastPostedAt() || discussion.createdAt())}>
                    <Icon name="far fa-comment" /> {discussion.replyCount()} · {shortAge(discussion.lastPostedAt() || discussion.createdAt())}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>,
      -100
    );
  });
}
