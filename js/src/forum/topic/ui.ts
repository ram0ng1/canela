/*
 * Estado de interface de cada post (quem curtiu aberto, botões extras à mostra,
 * respostas embutidas…) e as configurações da página do tópico.
 *
 * O CommentPost só se redesenha quando um SubtreeRetainer vê algo mudar (o
 * post, o autor, a edição). Um clique que só abre um painel não muda nada
 * disso, então cada mudança de estado aqui incrementa `version`, e o tema
 * registra essa versão no retainer do post.
 */
import app from 'flarum/forum/app';
import { forumBool, isExtensionEnabled } from '../utils/settings';

export interface PostUi {
  likers: boolean;
  more: boolean;
  share: boolean;
  replies: boolean;
  parent: boolean;
  version: number;
  /** O "copiado" do botão de link some sozinho depois de um instante. */
  copiedTimer?: number;
  /** Quando o leitor curtiu: o coração bate só logo depois do clique. */
  likeBump?: number;
}

export function postUi(component: any): PostUi {
  if (!component.canelaUi) {
    component.canelaUi = { likers: false, more: false, share: false, replies: false, parent: false, version: 0 };
  }

  return component.canelaUi;
}

/** Inverte um painel do post e avisa o retainer. */
export function togglePostUi(ui: PostUi, key: 'likers' | 'more' | 'share' | 'replies' | 'parent', value?: boolean): void {
  ui[key] = value ?? !ui[key];
  ui.version++;
}

export const topicSettings = {
  timeline: () => forumBool('canelaTopicTimeline', true),
  footer: () => forumBool('canelaTopicFooter', true),
  map: () => forumBool('canelaTopicMap', true),
  suggested: () => forumBool('canelaSuggestedTopics', true),
  userCard: () => forumBool('canelaUserCard', true),
  postActions: () => forumBool('canelaPostActions', true),
  embeddedReplies: () => forumBool('canelaEmbeddedReplies', true) && isExtensionEnabled('flarum-mentions'),
  /** O "em resposta a" numa linha embaixo do nome, como no avocado (canela.topic_reply_to_style). */
  replyToLine: () => app.forum?.attribute('canelaTopicReplyToStyle') === 'avocado' && isExtensionEnabled('flarum-mentions'),
  newRepliesBar: () => forumBool('canelaNewRepliesBar', true) && isExtensionEnabled('flarum-realtime'),
};

/** O controle de notificações do tópico só existe com o flarum/subscriptions e alguém logado. */
export function canSubscribe(): boolean {
  return isExtensionEnabled('flarum-subscriptions') && !!app.session.user;
}

/** Link absoluto, para copiar e compartilhar. */
export function absoluteUrl(path: string): string {
  return (app.forum.attribute<string>('baseOrigin') || window.location.origin) + path;
}
