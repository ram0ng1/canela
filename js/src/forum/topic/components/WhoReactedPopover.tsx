/*
 * Quem curtiu / quem reagiu: o popover do discourse-reactions que abre ao
 * clicar na contagem da barra do post — cartão branco com sombra, uma seta
 * apontando para a contagem, e a lista (avatar de 32px, nome e, à direita, o
 * coração ou o emoji da reação de cada um). Rola depois de ~8 pessoas.
 *
 * Serve às curtidas (flarum/likes) e às reações (fof/reactions): quem abre
 * passa o carregador da lista. Há um popover só para a página, montado num
 * <div> do body — dentro do post ele seria cortado e ficaria preso ao
 * SubtreeRetainer.
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import username from 'flarum/common/helpers/username';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

export interface ReactorEntry {
  user: User;
  /** O ícone à direita: o coração vermelho ou o emoji da reação. */
  icon: Mithril.Children;
}

interface State {
  anchor: HTMLElement;
  entries: ReactorEntry[] | null;
}

let state: State | null = null;
let root: HTMLElement | null = null;

/** Distância da seta até a contagem e das bordas da janela. */
const GAP = 10;
const EDGE = 8;

function onDocumentEvent(event: Event) {
  if (!state) return;

  if (event instanceof KeyboardEvent) {
    if (event.key === 'Escape') closeWhoReacted();
    return;
  }

  const target = event.target as Node;

  if (root?.contains(target) || state.anchor.contains(target)) return;

  closeWhoReacted();
}

function ensureRoot() {
  if (root) return;

  root = document.createElement('div');
  root.className = 'CanelaReactorsRoot';
  document.body.appendChild(root);

  m.mount(root, { view: () => (state ? <ReactorsPopover anchor={state.anchor} entries={state.entries} /> : null) });

  document.addEventListener('mousedown', onDocumentEvent, true);
  document.addEventListener('keydown', onDocumentEvent, true);
  window.addEventListener('popstate', () => closeWhoReacted());
}

export function closeWhoReacted(): void {
  if (!state) return;

  state = null;
  m.redraw();
}

/** Abre (ou fecha, num segundo clique na mesma contagem) a lista de quem reagiu. */
export function openWhoReacted(anchor: HTMLElement, load: () => Promise<ReactorEntry[]>): void {
  ensureRoot();

  if (state && state.anchor === anchor) {
    closeWhoReacted();
    return;
  }

  const current: State = { anchor, entries: null };
  state = current;
  m.redraw();

  load()
    .catch(() => [] as ReactorEntry[])
    .then((entries) => {
      if (state !== current) return;

      // Ninguém visível (sem permissão, ou a lista falhou): um cartão vazio
      // não diz nada — o popover simplesmente fecha.
      if (!entries.length) {
        closeWhoReacted();
        return;
      }

      current.entries = entries;
      m.redraw();
    });
}

/** O coração vermelho das curtidas (o emoji ❤️ do Discourse). */
export function heartIcon(): Mithril.Children {
  return <i aria-hidden="true" className="icon fas fa-heart CanelaReactors-heart" />;
}

interface PopoverAttrs {
  anchor: HTMLElement;
  entries: ReactorEntry[] | null;
}

class ReactorsPopover {
  view(vnode: Mithril.Vnode<PopoverAttrs, this>) {
    const { entries } = vnode.attrs;

    return (
      <div className="CanelaReactors" role="dialog" aria-label={app.translator.trans('ramon-canela.forum.topic.post.who_liked', {}, true) as string}>
        <span className="CanelaReactors-arrow" />
        {entries === null ? (
          <LoadingIndicator size="small" display="block" />
        ) : (
          <ul className="CanelaReactors-list">
            {entries.map((entry) => (
              <li>
                <Link className="CanelaReactors-user" href={app.route.user(entry.user)} onclick={() => closeWhoReacted()}>
                  <Avatar user={entry.user} />
                  <span className="CanelaReactors-name">{username(entry.user)}</span>
                  <span className="CanelaReactors-icon">{entry.icon}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<PopoverAttrs, this>) {
    this.place(vnode);
  }

  onupdate(vnode: Mithril.VnodeDOM<PopoverAttrs, this>) {
    this.place(vnode);
  }

  /** Logo abaixo da contagem, centrado nela, sem sair da janela. */
  place(vnode: Mithril.VnodeDOM<PopoverAttrs, this>) {
    const el = vnode.dom as HTMLElement;
    const rect = vnode.attrs.anchor.getBoundingClientRect();
    const width = el.offsetWidth;
    const center = rect.left + rect.width / 2;
    const left = Math.max(EDGE, Math.min(window.innerWidth - width - EDGE, center - width / 2));

    el.style.top = `${rect.bottom + window.scrollY + GAP}px`;
    el.style.left = `${left + window.scrollX}px`;
    el.style.setProperty('--cn-arrow-left', `${center - left}px`);
  }
}
