import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
export interface TopicFooterAttrs extends ComponentAttrs {
    discussion: Discussion;
    /** A DiscussionPage: os controles do tópico mudam conforme o contexto. */
    page: any;
}
export default class TopicFooter extends Component<TopicFooterAttrs> {
    markingUnread: boolean;
    view(): JSX.Element;
    /** Favorito = o marcador do primeiro post (o "bookmark" do tópico). */
    bookmarkButton(discussion: Discussion): JSX.Element | null;
    /** Sinalizar o tópico = sinalizar o primeiro post, com o modal do flarum/flags. */
    flagButton(discussion: Discussion): JSX.Element | null;
    /**
     * "Marcar não lido": a leitura volta para antes do último post lido e a
     * pessoa volta para a lista. Precisa do campo do tema
     * (extend/topic.php): o core só deixa a leitura andar para a frente.
     */
    unreadButton(discussion: Discussion): JSX.Element | null;
    replyButton(discussion: Discussion): JSX.Element;
}
