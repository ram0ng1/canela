/*
 * "Responder como discussão vinculada" — uma ação do menu "Tópico ▾" do
 * composer de resposta do Discourse. Troca a resposta por um tópico novo que leva o texto
 * já escrito, um link de volta ("Continuação de [título](link)") e as mesmas
 * tags do tópico de origem.
 */
import app from 'flarum/forum/app';
import Stream from 'flarum/common/utils/Stream';
import type Discussion from 'flarum/common/models/Discussion';

import { composerOn } from './common';
import { discardCurrentDraft } from './drafts/fofDrafts';
import { isTagsEnabled } from '../../utils/tags';
import { normalizeTags, selectableTags } from '../../composer/tagRules';
import { t } from '../../utils/settings';

function absoluteDiscussionUrl(discussion: Discussion): string {
  const path = app.route.discussion(discussion);
  const origin = app.forum.attribute<string>('baseOrigin') || window.location.origin;

  return /^https?:\/\//.test(path) ? path : origin + path;
}

/** Escapa os colchetes do título para ele não fechar o link markdown antes da hora. */
function markdownText(text: string): string {
  return text.replace(/([[\]\\])/g, '\\$1');
}

export async function replyAsLinkedTopic(discussion: Discussion): Promise<void> {
  const content = app.composer.fields?.content() || '';
  const intro = t('composer.linked_topic.continuation', {
    link: `[${markdownText(discussion.title())}](${absoluteDiscussionUrl(discussion)})`,
  });
  const tags = isTagsEnabled() ? ((discussion as any).tags?.() || []).filter(Boolean) : [];

  // O texto vai junto para o tópico novo, então perguntar "descartar a
  // resposta?" não faz sentido: a trava de saída do composer é tirada antes.
  (app.composer as any).onExit = null;

  // O rascunho da resposta também: o texto agora é do tópico novo, que terá
  // o rascunho dele.
  await discardCurrentDraft();

  // O texto entra como `originalContent`: o corpo o põe no campo antes de o
  // editor montar, e um rascunho de tópico novo que houver não passa por
  // cima dele (só é restaurado num composer vazio).
  await app.composer.load(() => import('flarum/forum/components/DiscussionComposer'), {
    user: app.session.user,
    originalContent: `${intro}\n\n${content}`.trimEnd() + '\n',
  });

  // `load` limpa os campos; o flarum/tags lê as tags de `fields.tags`.
  // Só as que o ator pode usar num tópico novo (as regras do flarum/tags).
  const allowed = normalizeTags(tags, selectableTags());
  if (allowed.length) (app.composer.fields as any).tags = allowed;
  (app.composer.fields as any).title = Stream('');

  await app.composer.show();
  await app.composer.editorReady();

  (document.querySelector('.DiscussionComposer-title') as HTMLInputElement | null)?.focus();
}

/**
 * Se o menu "Tópico ▾" do composer de resposta oferece "Responder como tópico
 * vinculado". O menu em si é desenhado pelo cabeçalho do composer
 * (`composer/ComposerActionTitle`), como o `composer-actions` do Discourse.
 */
export function canReplyAsLinkedTopic(): boolean {
  return composerOn('LinkedTopic') && !!app.forum.attribute<boolean>('canStartDiscussion');
}

export default function installLinkedTopic() {
  // Nada a registrar: o recurso é uma ação do menu do cabeçalho.
}
