/*
 * "Há N novas respostas" — a barra do Discourse quando chegam posts pelo
 * realtime enquanto o leitor está no meio do tópico. No fim do tópico o
 * flarum/realtime já acrescenta o post direto no stream, e a barra não
 * aparece; no meio, ele só atualiza a contagem, e é aí que ela avisa.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import type Discussion from 'flarum/common/models/Discussion';

import { t } from '../../utils/settings';

export interface NewRepliesBarAttrs extends ComponentAttrs {
  discussion: Discussion;
  stream: any;
  /** Onde a página guarda a contagem de comentários vista por último. */
  page: any;
}

export default class NewRepliesBar extends Component<NewRepliesBarAttrs> {
  view() {
    const { discussion, stream, page } = this.attrs;
    const count = discussion.commentCount() || 0;

    if (page.canelaSeenCount === undefined || stream.viewingEnd()) page.canelaSeenCount = count;

    const fresh = count - page.canelaSeenCount;

    if (fresh <= 0) return null;

    return (
      <div className="CanelaNewReplies" role="status">
        <button
          type="button"
          className="CanelaNewReplies-button"
          onclick={() => {
            page.canelaSeenCount = count;
            stream.goToLast();
          }}
        >
          <Icon name="fas fa-arrow-down" />
          {t('topic.new_replies', { count: fresh })}
        </button>
      </div>
    );
  }
}
