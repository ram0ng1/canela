/*
 * fof/best-answer no jeito do discourse-solved.
 *
 * - Na barra do post, o "✓ Solução" verde no post aceito; nos outros, quem
 *   pode escolher vê o quadradinho de marcar (o `far-square-check` do
 *   Discourse). O item da extensão no "…" e o rótulo no cabeçalho do post
 *   saem: seriam o mesmo controle duas vezes.
 * - A resposta aceita sobe para logo abaixo do conteúdo do 1º post, no
 *   acordeão do Discourse (cabeçalho verde "SOLUÇÃO", autor e o texto cortado
 *   em seis linhas, com a seta para abrir e a de ir até o post).
 * - Na lista, o ícone do selo vira o quadrado com o certo, em verde (CSS).
 *
 * A gravação é a mesma da extensão: a relação `bestAnswerPost` da discussão.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import CommentPost from 'flarum/forum/components/CommentPost';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import UserCard from 'flarum/forum/components/UserCard';
import PostControls from 'flarum/forum/utils/PostControls';
import username from 'flarum/common/helpers/username';
import classList from 'flarum/common/utils/classList';
import extractText from 'flarum/common/utils/extractText';
import humanTime from 'flarum/common/utils/humanTime';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { extModule, thirdParty } from './settings';

/** A resposta aceita da discussão, ou null (a relação vazia devolve `false`). */
function acceptedPost(discussion: Discussion | null | undefined): Post | null {
  const d = discussion as any;

  if (!d || !d.hasBestAnswer?.()) return null;

  return d.bestAnswerPost?.() || null;
}

function isAccepted(post: Post): boolean {
  const accepted = acceptedPost(post.discussion());

  return !!accepted && accepted.id() === post.id();
}

/** As mesmas regras da extensão: nunca o 1º post, nem post oculto, nem visitante. */
function canToggle(post: Post): boolean {
  return (
    !!app.session.user &&
    !post.isHidden() &&
    post.number() !== 1 &&
    post.contentType() === 'comment' &&
    !!(post as any).canSelectAsBestAnswer?.() &&
    !!app.current.matches(DiscussionPage)
  );
}

function save(discussion: Discussion, post: Post, accept: boolean): Promise<void> {
  return discussion
    .save({ relationships: { bestAnswerPost: accept ? post : ({ data: null } as any) } } as any, { params: { include: 'tags' } } as any)
    .then(() => {
      // Sem isso a relação antiga continua no modelo e o post segue "aceito".
      if (!accept && discussion.data.relationships) {
        delete (discussion.data.relationships as any).bestAnswerPost;
        delete (discussion.data.relationships as any).bestAnswerUser;
      }

      if (app.current.matches(DiscussionPage)) app.current.get('stream')?.update();

      m.redraw();
    });
}

/** "Marcada como solução por Fulano há 2 dias", para o title do selo verde. */
function acceptedBy(discussion: Discussion): string {
  const d = discussion as any;
  const user = d.bestAnswerUser?.();
  const at: Date | undefined = d.bestAnswerSetAt?.();

  if (!user) return t('thirdparty.solved.accepted_title');

  return t('thirdparty.solved.accepted_by', { username: extractText(username(user)), ago: at ? humanTime(at) : '' });
}

export default function installBestAnswer(): void {
  // "0 melhor resposta" no topo do perfil: o Discourse não mostra contagem
  // zerada. No beforeMount, para rodar depois do item do próprio fof.
  app.beforeMount(() => {
    extend(UserCard.prototype, 'infoItems', function (this: any, items: any) {
      const count = Number(this.attrs.user?.attribute?.('bestAnswerCount')) || 0;

      if (!count && items.has('best-answer-count')) items.remove('best-answer-count');
    });
  });

  extend(CommentPost.prototype, 'actionItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!thirdParty.solved()) return;

    const post: Post = this.attrs.post;

    // O botão "primário" da interface alternativa da extensão: o tema já tem o seu.
    items.remove('bestAnswer');

    if (post.isHidden() || post.number() === 1) return;

    const discussion = post.discussion();
    const accepted = isAccepted(post);
    const toggle = canToggle(post);

    if (accepted) {
      const label = t('thirdparty.solved.accepted');
      const title = acceptedBy(discussion);

      items.add(
        'canelaSolved',
        toggle ? (
          <Button
            className="Button Button--flat CanelaPostAction CanelaSolved CanelaSolved--accepted"
            icon="fas fa-square-check"
            title={`${title}: ${t('thirdparty.solved.unmark')}`}
            aria-pressed="true"
            onclick={() => save(discussion, post, false)}
          >
            {label}
          </Button>
        ) : (
          <span className="CanelaSolved CanelaSolved--accepted CanelaSolved--static" title={title}>
            <Icon name="fas fa-square-check" />
            <span className="CanelaSolved-label">{label}</span>
          </span>
        ),
        25
      );

      return;
    }

    if (!toggle) return;

    items.add(
      'canelaSolved',
      <Button
        className="Button Button--icon Button--flat CanelaPostAction CanelaSolved"
        icon="far fa-square-check"
        title={t('thirdparty.solved.mark')}
        aria-label={t('thirdparty.solved.mark')}
        aria-pressed="false"
        onclick={() => save(discussion, post, true)}
      />,
      25
    );
  });

  // O mesmo controle no "…" seria repetido.
  extend(PostControls, 'moderationControls', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.solved()) return;

    items.remove('bestAnswer');
  });

  // O Discourse não marca o cabeçalho do post aceito; o selo verde da barra basta.
  extend(CommentPost.prototype, 'headerItems', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.solved()) return;

    items.remove('isBestAnswer');
  });

  // A prévia da extensão no rodapé dá lugar ao acordeão dentro do conteúdo,
  // acima da barra de ações, onde o Discourse o põe.
  extend(CommentPost.prototype, 'footerItems', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.solved()) return;

    items.remove('bestAnswerPost');
  });

  // O post guarda a árvore (SubtreeRetainer): abrir o acordeão só redesenha
  // se o 1º post souber que o estado dele mudou.
  extend(CommentPost.prototype, 'oninit', function (this: any) {
    if (!thirdParty.solved()) return;

    if (this.attrs.post.number() !== 1) return;

    this.subtree.check(() => {
      const accepted = acceptedPost(this.attrs.post.discussion());

      return accepted ? solutionState(accepted).version : 0;
    });
  });

  extend(CommentPost.prototype, 'content', function (this: any, content: Mithril.Children[]) {
    if (!thirdParty.solved()) return;

    const post: Post = this.attrs.post;

    if (post.number() !== 1 || post.isHidden()) return;

    const accepted = acceptedPost(post.discussion());

    if (accepted && !accepted.isHidden()) content.push(<SolutionAccordion post={accepted} />);
  });

  // A resposta escolhida, no fluxo: um cartão com borda verde e a faixa
  // "Solução" no topo — o mesmo desenho do post sinalizado, em verde.
  extend(CommentPost.prototype, 'elementAttrs', function (this: any, attrs: Record<string, any>) {
    if (!thirdParty.solved() || !isAccepted(this.attrs.post)) return;

    attrs.className = classList(attrs.className, 'CanelaPost--solution');
  });

  extend(CommentPost.prototype, 'content', function (this: any, content: Mithril.Children[]) {
    if (!thirdParty.solved() || !isAccepted(this.attrs.post)) return;

    content.unshift(
      <div className="CanelaPost-solutionBar">
        <Icon name="fas fa-square-check" />
        <span>{t('thirdparty.solved.accepted_bar')}</span>
      </div>
    );
  });

  // O selo da lista: o quadrado com o certo (`square-check`) do Discourse.
  const Badge = extModule<any>('fof-best-answer', 'forum/components/BestAnswerBadge');

  if (Badge) {
    override(Badge, 'initAttrs', function (original: (attrs: any) => void, attrs: any) {
      original(attrs);
      if (thirdParty.solved()) attrs.icon = 'fas fa-square-check';
    });
  }
}

interface SolutionAccordionAttrs {
  post: Post;
}

/** Linhas visíveis antes de abrir (`--max-lines-displayed` do Discourse). */
const MAX_LINES = 6;

interface SolutionState {
  expanded: boolean;
  overflowing: boolean;
  version: number;
}

/** O estado do acordeão mora no post aceito, que o 1º post consegue observar. */
function solutionState(post: Post): SolutionState {
  const p = post as any;

  return (p.canelaSolution ??= { expanded: false, overflowing: false, version: 0 });
}

function setSolutionState(post: Post, changes: Partial<SolutionState>) {
  Object.assign(solutionState(post), changes);
  solutionState(post).version++;
  m.redraw();
}

class SolutionAccordion {
  get expanded(): boolean {
    return solutionState(this.post).expanded;
  }

  get overflowing(): boolean {
    return solutionState(this.post).overflowing;
  }

  post!: Post;

  oninit(vnode: Mithril.Vnode<SolutionAccordionAttrs, this>) {
    this.post = vnode.attrs.post;
  }

  onbeforeupdate(vnode: Mithril.Vnode<SolutionAccordionAttrs, this>) {
    this.post = vnode.attrs.post;
  }

  oncreate(vnode: Mithril.VnodeDOM<SolutionAccordionAttrs, this>) {
    this.measure(vnode.dom as HTMLElement);
  }

  onupdate(vnode: Mithril.VnodeDOM<SolutionAccordionAttrs, this>) {
    this.measure(vnode.dom as HTMLElement);
  }

  /** O degradê e a seta só aparecem quando o texto passa das seis linhas. */
  measure(dom: HTMLElement) {
    const content = dom.querySelector<HTMLElement>('.CanelaSolution-content');

    if (!content || this.expanded) return;

    const overflowing = content.scrollHeight > content.clientHeight + 1;

    if (overflowing !== this.overflowing) setSolutionState(this.post, { overflowing });
  }

  view(vnode: Mithril.Vnode<SolutionAccordionAttrs, this>) {
    const post = vnode.attrs.post;
    const user = post.user();
    const html = post.contentHtml();

    return (
      <div className="CanelaSolution" style={{ '--canela-solution-lines': MAX_LINES }}>
        <div className="CanelaSolution-header">
          <Icon name="fas fa-square-check" />
          <span className="CanelaSolution-title">{t('thirdparty.solved.title')}</span>
        </div>
        <div
          className={classList('CanelaSolution-item', {
            'CanelaSolution-item--expanded': this.expanded,
            'CanelaSolution-item--overflowing': this.overflowing,
          })}
        >
          <div className="CanelaSolution-itemHeader">
            <span className="CanelaSolution-meta">
              {user ? (
                <Link href={app.route.user(user)} className="CanelaSolution-user">
                  <Avatar user={user} />
                  <span className="CanelaSolution-username">{username(user)}</span>
                </Link>
              ) : (
                <span className="CanelaSolution-user">{username(user)}</span>
              )}
            </span>
            <span className="CanelaSolution-controls">
              <Link
                href={app.route.post(post)}
                className="Button Button--icon Button--flat CanelaSolution-jump"
                title={t('thirdparty.solved.jump')}
                aria-label={t('thirdparty.solved.jump')}
              >
                <Icon name="fas fa-arrow-down" />
              </Link>
              {(this.overflowing || this.expanded) && (
                <Button
                  className="Button Button--icon Button--flat CanelaSolution-toggle"
                  icon={this.expanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down'}
                  aria-expanded={this.expanded ? 'true' : 'false'}
                  aria-label={t(this.expanded ? 'thirdparty.solved.collapse' : 'thirdparty.solved.expand')}
                  title={t(this.expanded ? 'thirdparty.solved.collapse' : 'thirdparty.solved.expand')}
                  onclick={() => setSolutionState(post, { expanded: !this.expanded })}
                />
              )}
            </span>
          </div>
          {html ? <div className="CanelaSolution-content Post-body">{m.trust(html)}</div> : null}
        </div>
      </div>
    );
  }
}
