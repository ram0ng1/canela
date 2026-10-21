/*
 * "Me too" (problema compartilhado): abaixo do
 * primeiro post, a pílula "✋ Eu também", com a contagem entre parênteses
 * quando alguém já marcou ("Eu também (3)"). Quem marca passa a seguir o
 * tópico (o servidor cuida disso) e o ícone ganha a cor de destaque.
 *
 * Como no plugin: visitante clica e vai para o login; para o autor e com o
 * tópico trancado o botão fica só de leitura (apagado, com o motivo no
 * title); e some quando o tópico ganha melhor resposta, na hora.
 *
 * O servidor manda `canelaMeToo` = `{count, mine, can}` só na página do
 * tópico, e null quando o botão não vale ali (tag fora da lista, mensagem…).
 * Com o flarum/realtime, a contagem chega pelo websocket (ver realtime.ts).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import CommentPost from 'flarum/forum/components/CommentPost';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { forumBool, t } from '../../utils/settings';
import installMeTooRealtime from './realtime';

interface MeTooState {
  count: number;
  mine: boolean;
  can: boolean;
}

/** Tópicos com um pedido em andamento: o botão fica apagado até a resposta. */
const saving = new Set<string>();

function stateOf(discussion: Discussion | null | undefined | false): MeTooState | null {
  if (!discussion || !forumBool('canelaMeTooEnabled', false)) return null;

  const value = discussion.attribute<MeTooState | null | undefined>('canelaMeToo');

  if (!value || typeof value !== 'object') return null;

  // Escolher a melhor resposta não recarrega o tópico: o fórum esconde o
  // botão sozinho, como o plugin faz pelo `accepted_answers` do tópico.
  if (forumBool('canelaMeTooHideSolved', true) && (discussion as any).hasBestAnswer?.()) return null;

  return value;
}

export default function installMeToo(): void {
  // Com o flarum/realtime, a contagem muda sozinha quando outra pessoa clica.
  installMeTooRealtime();

  // O CommentPost só se redesenha quando o post muda (subtree retainer): a
  // contagem e o "salvando" entram na conferência dele.
  extend(CommentPost.prototype, 'oninit', function (this: any) {
    this.subtree.check(() => {
      const post = this.attrs.post as Post;

      if (post.number() !== 1) return '';

      const discussion = post.discussion() as Discussion;

      return JSON.stringify([stateOf(discussion), saving.has(String(discussion?.id())), (discussion as any)?.isLocked?.()]);
    });
  });

  // Logo depois do texto do post, antes da barra de ações: o lugar do
  // `post-content-cooked-html` em que o plugin pendura o botão.
  extend(CommentPost.prototype, 'content', function (this: any, content: Mithril.Children[]) {
    const post = this.attrs.post as Post;

    if (post.number() !== 1 || this.isEditing?.()) return;

    const discussion = post.discussion() as Discussion;
    const state = stateOf(discussion);

    if (state) content.push(m(MeTooRow as any, { discussion, post, state }));
  });
}

function MeTooRow(): Mithril.Component<{ discussion: Discussion; post: Post; state: MeTooState }> {
  return {
    view: ({ attrs: { discussion, post, state } }) => {
      const user = app.session.user;
      const isAuthor = !!user && post.user() === user;
      const isClosed = !!(discussion as any).isLocked?.();
      const busy = saving.has(String(discussion.id()));
      // O visitante vê o botão ativo: o clique é que o leva ao login.
      const disabled = busy || (!!user && (isAuthor || isClosed || !state.can));

      const label = state.count > 0 ? t('metoo.label_with_count', { label: t('metoo.label'), count: state.count }) : t('metoo.label');
      const title = isAuthor ? t('metoo.author_title') : isClosed ? t('metoo.closed_title') : t('metoo.title');

      return (
        <div className="CanelaMeToo">
          <Button
            className={classList('Button CanelaMeToo-button', { 'is-active': state.mine })}
            icon="fas fa-hand"
            title={title}
            aria-pressed={state.mine ? 'true' : 'false'}
            disabled={disabled}
            onclick={() => toggle(discussion, state)}
          >
            {label}
          </Button>
        </div>
      );
    },
  };
}

async function toggle(discussion: Discussion, state: MeTooState): Promise<void> {
  if (!app.session.user) {
    app.modal.show(() => flarum.reg.asyncModuleImport('flarum/forum/components/LogInModal'));
    return;
  }

  const id = String(discussion.id());

  if (saving.has(id)) return;

  saving.add(id);
  m.redraw();

  try {
    const apiUrl = ((app.forum.attribute<string>('apiUrl') as string) || '/api').replace(/\/+$/, '');
    const result = await app.request<{ count: number; mine: boolean; subscription: string | null }>({
      method: 'POST',
      url: `${apiUrl}/canela-me-too`,
      body: { discussionId: id },
    });

    const attributes: Record<string, unknown> = { canelaMeToo: { ...state, count: result.count, mine: result.mine } };

    // O rodapé do tópico mostra "Seguindo" na hora.
    if (result.subscription !== null && result.subscription !== undefined) attributes.subscription = result.subscription;

    discussion.pushAttributes(attributes);
  } catch {
    // O app.request já mostra o alerta do erro (429, 403…): o botão só volta.
  } finally {
    saving.delete(id);
    m.redraw();
  }
}
