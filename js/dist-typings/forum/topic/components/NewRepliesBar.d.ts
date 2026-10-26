import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
export interface NewRepliesBarAttrs extends ComponentAttrs {
    discussion: Discussion;
    stream: any;
    /** Onde a página guarda a contagem de comentários vista por último. */
    page: any;
}
export default class NewRepliesBar extends Component<NewRepliesBarAttrs> {
    view(): JSX.Element | null;
}
