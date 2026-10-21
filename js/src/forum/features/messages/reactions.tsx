/*
 * Reações nas mensagens privadas, com o mesmo desenho das reações dos posts do tema
 * (`thirdparty/reactions.tsx`): o resumo à esquerda da barra (até três emojis
 * e o total; o clique mostra quem reagiu) e o botão de reagir com o seletor
 * no hover/clique, que mostra o emoji escolhido depois de reagir (clicar nele
 * desfaz).
 *
 * A lista é a do fof/reactions quando ele está ligado (os emojis desenhados
 * pelo componente dele, as classes do seletor dele); sem ele, uma lista padrão
 * em emoji Unicode. Sem a tabela das reações, nada aparece.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { extModule } from '../../thirdparty/settings';
import { enabledReactions } from '../../thirdparty/reactions';
import { t } from '../../utils/settings';
import { messagesOn, type DialogMessage } from './util';

const MESSAGE = 'ext:flarum/messages/forum/components/Message';

/** Quantos emojis o resumo mostra, como nos posts. */
const SUMMARY_EMOJIS = 3;

/** As reações padrão, quando o fof/reactions não está ligado. */
const UNICODE: Record<string, string> = {
  heart: '❤️',
  '+1': '👍',
  laughing: '😆',
  open_mouth: '😮',
  cry: '😢',
  tada: '🎉',
  rocket: '🚀',
};

interface Config {
  enabled: boolean;
  fof: boolean;
  list: string[];
}

interface Summary {
  counts: Record<string, number>;
  mine: string | null;
}

function config(): Config | null {
  const value = app.forum?.attribute<Config | undefined>('canelaMessageReactions');

  return value && typeof value === 'object' && value.enabled ? value : null;
}

/** As chaves das reações que dá para escolher agora: as habilitadas do fof, na ordem dele. */
function available(cfg: Config): string[] {
  if (!cfg.fof) return cfg.list;

  return enabledReactions().map((reaction) => String(reaction.id()));
}

/** A chave do ❤️ (o clique direto no coração), se ele estiver na lista. */
function heartKey(cfg: Config, keys: string[]): string | null {
  if (!cfg.fof) return keys.indexOf('heart') !== -1 ? 'heart' : null;

  return keys.find((key) => (app.store.getById('reactions', key) as any)?.identifier?.() === 'heart') || null;
}

/** O emoji de uma chave: o componente do fof/reactions ou o Unicode. */
function emoji(cfg: Config, key: string): Mithril.Children {
  if (cfg.fof) {
    const ReactionComponent = extModule<any>('fof-reactions', 'common/components/ReactionComponent');
    const reaction = app.store.getById('reactions', key);

    return ReactionComponent && reaction ? m(ReactionComponent, { reaction }) : null;
  }

  return <span className="emoji CanelaUnicodeEmoji">{UNICODE[key] || key}</span>;
}

function label(cfg: Config, key: string): string {
  if (cfg.fof) return String((app.store.getById('reactions', key) as any)?.identifier?.() || key);

  return key;
}

function summary(message: DialogMessage): Summary {
  const value = message.attribute<Summary | undefined>('canelaReactions');

  return value && typeof value === 'object' ? { counts: value.counts || {}, mine: value.mine ?? null } : { counts: {}, mine: null };
}

function react(message: DialogMessage, key: string | null): Promise<void> {
  return app
    .request<Summary>({
      method: 'POST',
      url: `${app.forum.attribute('apiUrl')}/dialog-messages/${message.id()}/canela-react`,
      body: { reaction: key },
    })
    .then((result) => {
      message.pushAttributes({ canelaReactions: result });
      // O post do stream guarda a árvore (SubtreeRetainer): a "frescura"
      // muda para ele redesenhar.
      (message as any).freshness = new Date();
      m.redraw();
    });
}

interface ReactorsModalAttrs extends IInternalModalAttrs {
  message: DialogMessage;
}

/** Quem reagiu, agrupado por reação. */
class ReactorsModal extends Modal<ReactorsModalAttrs> {
  groups: Array<{ reaction: string; users: Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }> }> | null = null;

  oninit(vnode: Mithril.Vnode<ReactorsModalAttrs, this>) {
    super.oninit(vnode);

    app
      .request<{ groups: any[] }>({
        method: 'GET',
        url: `${app.forum.attribute('apiUrl')}/dialog-messages/${this.attrs.message.id()}/canela-reactions`,
      })
      .then((result) => {
        this.groups = result.groups || [];
        m.redraw();
      })
      .catch(() => {
        this.groups = [];
        m.redraw();
      });
  }

  className(): string {
    return 'Modal--small ReactionsModal CanelaMessageReactorsModal';
  }

  title(): Mithril.Children {
    return t('messages.reactions.reactors_title');
  }

  content(): Mithril.Children {
    const cfg = config();

    if (!this.groups || !cfg) return <div className="Modal-body">{<LoadingIndicator />}</div>;

    return (
      <div className="Modal-body">
        {this.groups.map((group) => (
          <div className="CanelaMessageReactors-group">
            <div className="ReactionsModal-groupHeader CanelaMessageReactors-header">
              {emoji(cfg, group.reaction)}
              <span className="ReactionsModal-reactionCount">{group.users.length}</span>
            </div>
            <ul className="CanelaMessageReactors-users">
              {group.users.map((user) => {
                const model = app.store.getById<any>('users', user.id);

                return (
                  <li className="ReactionsModal-user">
                    {model ? <Avatar user={model} /> : user.avatarUrl ? <img className="Avatar" src={user.avatarUrl} alt="" /> : null}
                    {model ? <Link href={app.route.user(model)}>{user.displayName}</Link> : <span>{user.displayName}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    );
  }
}

/**
 * O botão de reagir com o seletor, nas classes do fof/reactions para herdar o
 * desenho dos posts. Já reagiu: o emoji escolhido, que desfaz ao clicar.
 */
class ReactButton {
  open = false;
  pressTimer = 0;
  suppressClick = false;
  element: HTMLElement | null = null;

  oncreate(vnode: Mithril.VnodeDOM<any>) {
    this.element = vnode.dom as HTMLElement;
  }

  onremove() {
    window.clearTimeout(this.pressTimer);
    document.removeEventListener('pointerdown', this.outside, true);
  }

  outside = (event: Event) => {
    if (this.element && !this.element.contains(event.target as Node)) this.setOpen(false);
  };

  /**
   * Abre/fecha mexendo na classe direto: a mensagem fica guardada pelo
   * SubtreeRetainer e não se redesenha por um estado só deste botão.
   */
  setOpen(open: boolean) {
    this.open = open;
    this.element?.querySelector('.Reactions--react')?.classList.toggle('is-open', open);
    this.element?.querySelector('.CommentPost--Reactions')?.classList.toggle('mobile-show', open);

    if (open) document.addEventListener('pointerdown', this.outside, true);
    else document.removeEventListener('pointerdown', this.outside, true);
  }

  /** No toque, segurar o coração abre o seletor (o clique que vem depois não reage). */
  press(event: PointerEvent) {
    this.suppressClick = false;

    if (event.pointerType === 'mouse') return;

    window.clearTimeout(this.pressTimer);
    this.pressTimer = window.setTimeout(() => {
      this.suppressClick = true;
      this.setOpen(true);
    }, 400);
  }

  view(vnode: Mithril.Vnode<{ message: DialogMessage; cfg: Config }>): Mithril.Children {
    const { message, cfg } = vnode.attrs;
    const mine = summary(message).mine;
    const keys = available(cfg);
    const heart = heartKey(cfg, keys);
    const reactLabel = t('messages.reactions.react');

    return (
      <div className="Reactions CanelaMessageReact">
        <div className={classList('Reactions--react', { 'is-open': this.open })}>
          {mine ? (
            <Button
              className="Button Button--link Reactions--ShowReactions CanelaReactions-mine"
              title={t('messages.reactions.unreact')}
              aria-label={t('messages.reactions.unreact')}
              onclick={() => react(message, null).catch(() => {})}
            >
              {/* Curtido: o coração cheio, do mesmo tamanho do vazio (como nos
                  posts); outra reação: o emoji dela, no mesmo tamanho. */}
              {mine === heart ? <Icon name="fas fa-heart" className="Button-icon CanelaMessageReact-liked" /> : emoji(cfg, mine)}
            </Button>
          ) : (
            // O coração, como nos posts: o clique reage com o
            // ❤️; o hover (ou o toque longo) abre o seletor.
            <Button
              className="Button Button--link Reactions--ShowReactions CanelaMessageReact-heart"
              icon="far fa-heart"
              title={reactLabel}
              aria-label={reactLabel}
              aria-haspopup="menu"
              onpointerdown={(event: PointerEvent) => this.press(event)}
              onpointerup={() => window.clearTimeout(this.pressTimer)}
              onpointercancel={() => window.clearTimeout(this.pressTimer)}
              onclick={() => {
                if (this.suppressClick) {
                  this.suppressClick = false;
                  return;
                }

                if (heart) {
                  this.setOpen(false);
                  react(message, heart).catch(() => {});
                } else {
                  this.setOpen(!this.open);
                }
              }}
            />
          )}
          <div className={classList('CommentPost--Reactions Reactions--reactions', { 'mobile-show': this.open })} role="menu">
            <ul className="Reactions--Ul">
              {keys.map((key) => (
                <li>
                  <Button
                    className={classList('Button Button--link', { active: key === mine })}
                    title={label(cfg, key)}
                    aria-label={label(cfg, key)}
                    onclick={() => {
                      this.setOpen(false);
                      react(message, key === mine ? null : key).catch(() => {});
                    }}
                  >
                    {emoji(cfg, key)}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }
}

export default function installMessageReactions(): void {
  extend(MESSAGE as any, 'actionItems', function (this: any, items: ItemList<Mithril.Children>) {
    const cfg = config();

    if (!messagesOn() || !cfg) return;

    const message: DialogMessage = this.attrs.message;
    const { counts } = summary(message);
    const list = Object.keys(counts)
      .map((key) => [key, Number(counts[key]) || 0] as [string, number])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    // O resumo à esquerda: até três emojis e o total; o clique mostra quem reagiu.
    if (list.length) {
      const total = list.reduce((sum, [, count]) => sum + count, 0);
      const text = t('thirdparty.reactions.summary', { count: total });

      items.add(
        'canelaReactions',
        <Button
          className="Button Button--flat CanelaPostAction CanelaReactions"
          aria-label={text}
          title={text}
          onclick={() => app.modal.show(ReactorsModal, { message })}
        >
          <span className="CanelaReactions-list">
            {list.slice(0, SUMMARY_EMOJIS).map(([key]) => (
              <span className="CanelaReactions-emoji">{emoji(cfg, key)}</span>
            ))}
          </span>
          <span className="CanelaReactions-count">{abbreviateNumber(total)}</span>
        </Button>,
        1050
      );
    }

    items.add('react', m(ReactButton, { message, cfg }), 60);
  });
}
