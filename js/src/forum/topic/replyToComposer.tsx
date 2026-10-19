/*
 * O composer no "em resposta a" do avocado (canela.topic_reply_to_style =
 * avocado): a menção do post respondido (`@"Fulano"#p7`) que abre o texto sai
 * da área de digitação e vira o indicador "↳ Em resposta a [avatar] Fulano ×"
 * no cabeçalho do composer. Ao enviar ela volta ao começo do conteúdo: o
 * flarum/mentions precisa dela para ligar a resposta, e o post salvo é o mesmo
 * de sempre.
 *
 * Vale ao responder (a menção chega pelo "Responder" do mentions, por citar ou
 * por um rascunho) e ao editar (a menção já está no começo do post). Só a
 * menção do começo vira indicador; uma menção no meio do texto fica onde está.
 *
 * Rascunhos (fof/drafts): o fof salva o `data()` do corpo do composer, que já
 * leva a menção de volta; ao abrir o rascunho ela vira o indicador de novo.
 *
 * Portado de avocado-v2/js/src/forum/utils/replyTo.ts.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import type PostModel from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { topicSettings } from './ui';

/** A menção de post no começo do texto-fonte: `@"Fulano"#p7` e um espaço. */
const LEADING_MENTION = /^@"((?:[^"\\]|\\.)+)"#p(\d+)[ \t]?/;

interface ComposerReply {
  /** O id do post respondido. */
  id: string;
  /** O nome que a menção mostra. */
  name: string;
  /** A menção como estava no texto, para voltar igual ao enviar. */
  raw: string;
}

const BODIES = ['flarum/forum/components/ReplyComposer', 'flarum/forum/components/EditPostComposer'];

function composerReply(composer: any): ComposerReply | null {
  return composer?.fields?.canelaReplyTo || null;
}

/**
 * Tira a menção do começo do texto e guarda no composer. Roda a cada mudança
 * do texto (o editor só existe depois do primeiro desenho, daí a espera).
 */
function absorbLeadingMention(composer: any, attrs: any): void {
  const editor = composer?.editor;

  if (!topicSettings.replyToLine() || !composer?.fields?.content || !editor) return;

  const content = String(composer.fields.content() || '');
  const match = content.match(LEADING_MENTION);

  if (!match) return;

  const raw = match[0];
  composer.fields.canelaReplyTo = { id: match[2], name: match[1].replace(/\\(.)/g, '$1'), raw } as ComposerReply;

  // O texto "original" é o que o fechar compara para perguntar se descarta: o
  // mentions grava a menção nele ao abrir uma resposta vazia, e a edição grava
  // o post inteiro. Sem tirar dali também, fechar sem escrever nada
  // perguntaria se quer descartar.
  for (const target of [composer.body?.attrs, attrs]) {
    const original = target?.originalContent;

    if (typeof original === 'string' && original.startsWith(raw)) target.originalContent = original.slice(raw.length);
  }

  editor.insertBetween(0, raw.length, '', false);

  // O `insertBetween` com texto vazio depende do navegador (execCommand): se
  // a menção ficou, a textarea é ajustada direto.
  const el: HTMLTextAreaElement | undefined = editor.el;

  if (String(composer.fields.content() || '').startsWith(raw) && el && typeof el.value === 'string') {
    el.value = el.value.slice(raw.length);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  m.redraw();
}

/** O autor do post respondido, se ele já está carregado (ou um usuário com o nome da menção). */
function replyUser(reply: ComposerReply): User | null {
  const post = app.store.getById<PostModel>('posts', reply.id);
  const user = post?.user();

  if (user) return user;

  return (app.store.all('users') as User[]).find((item) => item.displayName() === reply.name || item.username() === reply.name) || null;
}

function ReplyIndicator(composer: any, reply: ComposerReply): Mithril.Children {
  const user = replyUser(reply);

  return (
    <span className="CanelaComposerReplyTo">
      <Icon name="fas fa-reply" className="CanelaComposerReplyTo-icon" />
      <span className="CanelaComposerReplyTo-label">{t('topic.post.reply_to_label')}</span>
      {user ? <Avatar user={user} /> : null}
      <span className="CanelaComposerReplyTo-name">{reply.name}</span>
      <button
        type="button"
        className="CanelaComposerReplyTo-remove"
        aria-label={t('topic.post.remove_reply')}
        title={t('topic.post.remove_reply')}
        // Desfaz a resposta: o texto já está sem a menção, ela só não volta ao enviar.
        onclick={() => {
          composer.fields.canelaReplyTo = null;
          composer.editor?.focus?.();
        }}
      >
        <Icon name="fas fa-times" />
      </button>
    </span>
  );
}

export default function installReplyToComposer(): void {
  BODIES.forEach((module) => {
    extend(module as any, 'oninit', function (this: any) {
      const composer = this.attrs.composer;

      composer.fields.content.map(() => {
        if (!topicSettings.replyToLine()) return;

        Promise.resolve(composer.editorReady?.())
          .then(() => absorbLeadingMention(composer, this.attrs))
          .catch(() => {});
      });
    });

    // Depois do título do composer (prioridade 1000 no tema).
    extend(module as any, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
      const reply = topicSettings.replyToLine() ? composerReply(this.attrs.composer) : null;

      if (reply) items.add('canelaReplyTo', ReplyIndicator(this.attrs.composer, reply), 900);
    });

    // Ao enviar (e ao salvar o rascunho do fof/drafts), a menção volta ao começo.
    extend(module as any, 'data', function (this: any, data: any) {
      const reply = composerReply(this.attrs.composer);

      if (reply && data && typeof data.content === 'string' && !data.content.startsWith(reply.raw)) {
        data.content = reply.raw + data.content;
      }
    });
  });
}
