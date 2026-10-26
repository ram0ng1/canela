import type Discussion from 'flarum/common/models/Discussion';
export declare function replyAsLinkedTopic(discussion: Discussion): Promise<void>;
/**
 * Se o menu "Tópico ▾" do composer de resposta oferece "Responder como tópico
 * vinculado". O menu em si é desenhado pelo cabeçalho do composer
 * (`composer/ComposerActionTitle`).
 */
export declare function canReplyAsLinkedTopic(): boolean;
export default function installLinkedTopic(): void;
