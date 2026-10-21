/*
 * A primeira linha do composer: a ação em negrito
 * com o ícone ("Iniciar Discussão", "Tópico ▾", "Editando postagem") e, quando o
 * tópico de destino não está na tela, o link "🔗 título" para ele.
 *
 * Na resposta, "Tópico ▾" abre o menu de ações (`composer-actions`): responder
 * ao tópico ou responder como tópico vinculado. Minimizado, a linha vira a
 * barra do rascunho: o ícone e o título do tópico (ou o aviso de rascunho).
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Dropdown from 'flarum/common/components/Dropdown';
import Button from 'flarum/common/components/Button';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import Stream from 'flarum/common/utils/Stream';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { canReplyAsLinkedTopic, replyAsLinkedTopic } from '../features/composer/installLinkedTopic';
import { t } from '../utils/settings';
import { isPhone } from '../motion/motionUtils';

export type ComposerKind = 'new_topic' | 'reply' | 'edit' | (string & {});

/** Uma ação do menu do cabeçalho: ícone, rótulo em negrito e descrição. */
export interface ComposerAction {
  icon: string;
  label: string;
  description: string;
  onclick: () => void;
}

export interface ComposerActionTitleAttrs extends ComponentAttrs {
  kind: ComposerKind;
  discussion?: Discussion;
  post?: Post;
  /** Rótulo e ícone próprios (outro composer, como o de mensagens). */
  label?: string;
  icon?: string;
  /** O título digitado no tópico novo (para a barra minimizada). */
  title?: () => string;
}

/** Os ícones das ações (lápis no quadrado, a caixa com a seta, lápis). */
const ICONS: Record<string, string> = {
  new_topic: 'far fa-pen-to-square',
  reply: 'fas fa-arrow-up-from-bracket',
  edit: 'fas fa-pencil',
};

/** Num composer em tela cheia, seguir um link minimiza antes, como o core. */
function minimizeIfFullScreen(e: MouseEvent): void {
  if (app.composer.position === 'fullScreen') {
    app.composer.minimize();
    e.stopPropagation();
  }
}

/**
 * Troca o tipo do composer levando o texto já escrito (as ações "Responder
 * ao tópico" / "Iniciar Discussão" do menu). A pergunta "descartar?"
 * não faz sentido: o texto vai junto.
 */
async function switchTo(kind: 'reply' | 'new_topic', discussion: Discussion | null): Promise<void> {
  const content = app.composer.fields?.content() || '';
  const title = (app.composer.fields as any)?.title?.() || '';
  const module = kind === 'reply' ? 'flarum/forum/components/ReplyComposer' : 'flarum/forum/components/DiscussionComposer';

  (app.composer as any).onExit = null;

  await app.composer.load(() => flarum.reg.asyncModuleImport(module), {
    user: app.session.user,
    ...(discussion ? { discussion } : {}),
    originalContent: content,
  });
  if (title && kind === 'new_topic') (app.composer.fields as any).title = Stream(title);

  await app.composer.show();
}

export { switchTo as switchComposer };

export default class ComposerActionTitle extends Component<ComposerActionTitleAttrs> {
  view(): Mithril.Children {
    if (app.composer.position === 'minimized') return this.draftView();

    return (
      <div className="CanelaComposerAction" role="heading" aria-level={1}>
        {this.trigger()}
        {this.targetLink()}
      </div>
    );
  }

  /** A barra do composer minimizado (`#reply-control.draft .draft-text`). */
  draftView(): Mithril.Children {
    const { kind, discussion, post, title } = this.attrs;
    const topic = kind === 'reply' ? discussion : kind === 'edit' ? post?.discussion() : null;
    const text = topic ? topic.title() : title?.() || t('composer.shell.saved_draft');

    return (
      <div className="CanelaComposerAction CanelaComposerAction--draft">
        {topic ? <Icon name={ICONS.reply} /> : null}
        <span className="CanelaComposerAction-draftText">{text}</span>
      </div>
    );
  }

  label(): string {
    const labels: Record<string, string> = {
      new_topic: t('composer.shell.action_new_topic'),
      reply: t('composer.shell.action_reply'),
      edit: t('composer.shell.action_edit'),
    };

    return this.attrs.label || labels[this.attrs.kind] || '';
  }

  icon(): string {
    return this.attrs.icon || ICONS[this.attrs.kind] || ICONS.new_topic;
  }

  trigger(): Mithril.Children {
    const { kind } = this.attrs;
    const label = this.label();
    const actions = this.actionItems().toArray();

    // Sem outras ações, o rótulo fica parado, sem a seta.
    if (!actions.length) {
      return (
        <span className="CanelaComposerAction-trigger CanelaComposerAction-trigger--static">
          <Icon name={this.icon()} />
          <span className="CanelaComposerAction-label">{label}</span>
        </span>
      );
    }

    return (
      <Dropdown
        className="CanelaComposerAction-menu"
        buttonClassName="Button CanelaComposerAction-trigger"
        menuClassName="CanelaComposerAction-dropdown"
        icon={this.icon()}
        caretIcon="fas fa-angle-down"
        label={<span className="CanelaComposerAction-label">{label}</span>}
        accessibleToggleLabel={t('composer.linked_topic.menu_label')}
      >
        {actions.map((action) => this.actionButton(action.icon, action.label, action.description, action.onclick))}
      </Dropdown>
    );
  }

  /**
   * As OUTRAS ações do menu (`composer-actions`): a atual não aparece. Trocar
   * de tipo leva o título e o texto. É o ponto de extensão do menu: outro
   * recurso (as mensagens privadas) estende este método para pôr "Criar
   * mensagem" / "Responder como mensagem privada":
   *
   *   extend(ComposerActionTitle.prototype, 'actionItems', function (items) {
   *     items.add('message', { icon, label, description, onclick }, 50);
   *   });
   *
   * `this.attrs.kind` diz qual composer está aberto ('new_topic' | 'reply' |
   * 'edit', ou o que o outro composer passar).
   */
  actionItems(): ItemList<ComposerAction> {
    const { kind, discussion } = this.attrs;
    const items = new ItemList<ComposerAction>();
    const viewing = (app.current.get('discussion') as Discussion | undefined) || null;
    const canStart = !!app.forum.attribute<boolean>('canStartDiscussion');

    if (kind === 'new_topic' && viewing && (viewing as any).canReply?.()) {
      items.add(
        'reply',
        {
          icon: ICONS.reply,
          label: t('composer.linked_topic.reply'),
          description: t('composer.shell.reply_to_topic_desc'),
          onclick: () => switchTo('reply', viewing),
        },
        100
      );
    }

    if (kind === 'reply' && discussion) {
      if (canReplyAsLinkedTopic()) {
        items.add(
          'linkedTopic',
          {
            icon: 'fas fa-plus',
            label: t('composer.linked_topic.new_topic'),
            description: t('composer.shell.reply_as_new_topic_desc'),
            onclick: () => replyAsLinkedTopic(discussion),
          },
          100
        );
      }

      if (canStart) {
        items.add(
          'newTopic',
          {
            icon: ICONS.new_topic,
            label: t('composer.shell.action_create_topic'),
            description: t('composer.shell.create_topic_desc'),
            onclick: () => switchTo('new_topic', null),
          },
          90
        );
      }
    }

    // Outro composer (o de mensagens) que reutilize este cabeçalho pode
    // voltar para tópico.
    if (kind !== 'new_topic' && kind !== 'reply' && kind !== 'edit' && canStart) {
      items.add(
        'newTopic',
        {
          icon: ICONS.new_topic,
          label: t('composer.shell.action_create_topic'),
          description: t('composer.shell.create_topic_desc'),
          onclick: () => switchTo('new_topic', null),
        },
        90
      );
    }

    return items;
  }

  /** Um item do menu de ações: ícone, rótulo em negrito e a descrição. */
  actionButton(icon: string, label: string, description: string, onclick: (() => void) | null, current = false): Mithril.Children {
    // A ação atual não entra mais no menu; `current` fica
    // para quem estender.
    return (
      <Button
        className={`Button CanelaComposerAction-btn${current ? ' CanelaComposerAction-btn--current' : ''}`}
        onclick={onclick || undefined}
        disabled={current}
      >
        <span className="CanelaComposerAction-btnIcon">
          <Icon name={icon} />
        </span>
        <span className="CanelaComposerAction-btnTexts">
          <span className="CanelaComposerAction-btnLabel">{label}</span>
          <span className="CanelaComposerAction-btnDescription">{description}</span>
        </span>
      </Button>
    );
  }

  /**
   * "🔗 título": o destino da resposta ou da edição. Na resposta, só quando o
   * tópico não está aberto atrás do composer — ele some ao responder do
   * próprio tópico. No celular, sempre: lá o editor
   * ocupa a tela e esconde o tópico.
   */
  targetLink(): Mithril.Children {
    const { kind, discussion, post } = this.attrs;

    // No celular o editor cobre o tópico inteiro: o título aparece sempre.
    if (kind === 'reply' && discussion && (!app.viewingDiscussion(discussion) || isPhone())) {
      return (
        <Link
          className="CanelaComposerAction-target"
          href={app.route.discussion(discussion)}
          onclick={minimizeIfFullScreen}
          title={discussion.title()}
        >
          <Icon name="fas fa-link" />
          <span className="CanelaComposerAction-targetLabel">{discussion.title()}</span>
        </Link>
      );
    }

    if (kind === 'edit' && post) {
      const target = post.discussion();
      const text = app.translator.trans('core.forum.composer_edit.post_link', { number: post.number(), discussion: target.title() }, true) as string;

      return (
        <Link className="CanelaComposerAction-target" href={app.route.discussion(target, post.number())} onclick={minimizeIfFullScreen} title={text}>
          <Icon name="fas fa-link" />
          <span className="CanelaComposerAction-targetLabel">{text}</span>
        </Link>
      );
    }

    return null;
  }
}
