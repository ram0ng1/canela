/*
 * A aba "Mensagens" do perfil (`/u/:username/messages[/:box]`): a linha das caixas e a lista de
 * mensagens no formato da lista de tópicos.
 *
 * Mensagens são pessoais: a API do flarum/messages só devolve as conversas de
 * quem pede, então a aba só existe no próprio perfil; no de outra pessoa a
 * página volta para o perfil.
 */
import app from 'flarum/forum/app';
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import BoxListState, { refreshCounts } from './BoxListState';
import MessagesList from './MessagesList';
import MessagesNav from './MessagesNav';
import { t } from '../../utils/settings';
import { availableBoxes, canSendMessages, messagesOn, type Box, messageStaff } from './util';

export default class UserMessagesPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  boxState: BoxListState | null = null;

  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    super.show(user);

    if (!messagesOn() || app.session.user !== user) {
      m.route.set(app.route.user(user), {}, { replace: true });
      return;
    }

    app.setTitle(t('messages.page.title'));
  }

  /** A caixa do endereço (a rota das caixas ou, sem o backend, a query). */
  box(): Box {
    const box = m.route.param('box') as Box | undefined;

    return box && availableBoxes().includes(box) ? box : 'inbox';
  }

  /** O estado da caixa atual; trocar de aba (mesma página, outra rota) troca o estado. */
  listState(): BoxListState {
    const box = this.box();

    if (!this.boxState || this.boxState.getParams().box !== box) {
      this.boxState = BoxListState.forBox(box);
      this.boxState.refresh().catch(() => {});
    }

    return this.boxState;
  }

  content(): Mithril.Children {
    if (!this.user || app.session.user !== this.user || !messagesOn()) return null;

    const state = this.listState();

    return (
      <div className="CanelaUserMessages">
        <MessagesNav
          user={this.user}
          box={this.box()}
          onsent={() => {
            state.refresh().catch(() => {});
            refreshCounts();
          }}
        />
        <section className="CanelaUserMessages-content">
          <MessagesList state={state} empty={() => this.emptyState()} />
        </section>
      </div>
    );
  }

  /**
   * O estado vazio (título e texto). O texto
   * aponta para o botão de mensagem do cartão de usuário e para a página
   * "Sobre", onde estão os membros da equipe.
   */
  emptyState(): Mithril.Children {
    const aboutHref = (app.routes as any).about ? app.route('about') : app.route('index');

    return (
      <div className="CanelaMessagesEmpty empty-state">
        <div className="empty-state__container --text-only">
          <span className="empty-state__title" role="heading" aria-level={2}>
            {t('messages.empty.title')}
          </span>
          {canSendMessages() ? (
            <div className="empty-state__body">
              <p>{app.translator.trans('ramon-canela.forum.messages.empty.body_1', { icon: <Icon name="fas fa-envelope" /> })}</p>
              <p>
                {app.translator.trans('ramon-canela.forum.messages.empty.body_2', {
                  a: <Link href={aboutHref} onclick={(event: MouseEvent) => messageStaff(event)} />,
                })}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}
