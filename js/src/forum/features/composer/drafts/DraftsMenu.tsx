/*
 * O "⌄" à direita do botão "Iniciar Discussão" (o `topic-drafts-menu` do
 * Discourse): abre os rascunhos do fof/drafts, um por linha com o ícone do
 * tipo e o título truncado ("RE: …" nas respostas). Clicar reabre o composer
 * com o rascunho. Mostra até quatro, como o Discourse, e "Ver todos" leva à
 * aba Rascunhos do perfil.
 *
 * Como no Discourse, o menu abre À DIREITA do botão, fora da barra lateral e
 * por cima do conteúdo (topo alinhado ao do botão, 8px depois do "⌄", até
 * 540px de largura). A barra corta o que transborda, então a posição é fixa,
 * calculada a partir do botão. No celular, abre embaixo, da largura da barra.
 * Fechar ao clicar fora ou com Esc é do Dropdown do core.
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Dropdown from 'flarum/common/components/Dropdown';
import Tooltip from 'flarum/common/components/Tooltip';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

import { allDrafts, draftCount, draftIcon, draftsLoaded, draftsOn, draftTitle, ensureDiscussions, loadDrafts, openDraft } from './fofDrafts';
import { t } from '../../../utils/settings';

const LIMIT = 4;
const GAP = 8;
const MAX_WIDTH = 540;

/** O ⌄ só existe com rascunhos (e com o fof-drafts ligado). */
export function showDraftsMenu(): boolean {
  return draftsOn() && draftCount() > 0;
}

/**
 * O tooltip do "⌄" abre para fora da barra lateral (à direita), preso ao
 * <body>: dentro da barra, que rola, ele era cortado e quebrava em linhas.
 */
class DraftsDropdown extends Dropdown {
  getButton(children: Mithril.ChildArray): Mithril.Vnode<any, any> {
    const vnode = super.getButton(children) as Mithril.Vnode<any, any>;

    if (vnode && vnode.tag === Tooltip) {
      vnode.attrs = { ...vnode.attrs, position: 'right', container: 'body' };
    }

    return vnode;
  }
}

export default class DraftsMenu extends Component {
  private readonly place = () => {
    const root = this.element as HTMLElement | undefined;
    const menu = root?.querySelector<HTMLElement>('.CanelaDraftsMenu-menu');
    const anchor = root?.closest<HTMLElement>('.CanelaSidebar-newTopic') || root;

    if (!root || !menu || !anchor || !root.classList.contains('open')) return;

    const rect = anchor.getBoundingClientRect();
    const phone = window.innerWidth < 768;
    const left = phone ? rect.left : rect.right + GAP;
    const width = phone ? rect.width : Math.max(240, Math.min(MAX_WIDTH, window.innerWidth - left - 16));

    // `important`: o Dropdown do core troca as classes --top/--right ao abrir.
    const set = (prop: string, value: string) => menu.style.setProperty(prop, value, 'important');

    set('position', 'fixed');
    set('top', `${phone ? rect.bottom + 4 : rect.top}px`);
    set('left', `${left}px`);
    set('right', 'auto');
    set('bottom', 'auto');
    set('width', `${width}px`);
    set('max-width', 'none');
    set('margin', '0');
    // No celular o core desenha os menus como folha de baixo (com respiro embaixo).
    set('padding', '4px 0');
    set('max-height', `${Math.max(160, window.innerHeight - (phone ? rect.bottom + 4 : rect.top) - 16)}px`);
    set('overflow-y', 'auto');
  };

  oninit(vnode: Mithril.Vnode) {
    super.oninit(vnode);

    // Já traz a lista: o menu abre com os títulos prontos.
    if (!draftsLoaded()) loadDrafts().then(() => m.redraw());
  }

  oncreate(vnode: Mithril.VnodeDOM) {
    super.oncreate(vnode);

    window.addEventListener('resize', this.place);
    window.addEventListener('scroll', this.place, true);
  }

  onupdate(vnode: Mithril.VnodeDOM) {
    super.onupdate(vnode);

    this.place();
  }

  onremove(vnode: Mithril.VnodeDOM) {
    super.onremove(vnode);

    window.removeEventListener('resize', this.place);
    window.removeEventListener('scroll', this.place, true);
  }

  view() {
    const label = t('composer.drafts.menu_label');

    return (
      <DraftsDropdown
        className="CanelaDraftsMenu"
        buttonClassName="Button Button--primary CanelaDraftsMenu-toggle"
        menuClassName="CanelaDraftsMenu-menu"
        icon="fas fa-chevron-down"
        caretIcon=""
        label=""
        accessibleToggleLabel={label}
        tooltip={label}
        lazyDraw
        onshow={() => {
          // O tooltip "Abrir rascunhos" mora no <body> (fora da barra): com o
          // menu aberto ele some, senão ficava por cima do menu.
          $(this.element).find('.CanelaDraftsMenu-toggle').tooltip('hide');
          this.place();
          // O core reposiciona o menu logo depois do onshow: confere de novo.
          requestAnimationFrame(this.place);
        }}
      >
        {this.items()}
      </DraftsDropdown>
    );
  }

  items(): Mithril.Children[] {
    if (!draftsLoaded()) return [<LoadingIndicator size="small" display="block" />];

    const drafts = allDrafts();

    ensureDiscussions(drafts.slice(0, LIMIT));

    const items: Mithril.Children[] = drafts.slice(0, LIMIT).map((draft) => {
      const title = draftTitle(draft);

      return (
        <Button className="CanelaDraftsMenu-item" icon={draftIcon(draft)} title={title} onclick={() => openDraft(draft)}>
          <span className="CanelaDraftsMenu-title">{title}</span>
        </Button>
      );
    });

    const user = app.session.user;

    if (user && draftCount() > LIMIT) {
      items.push(
        <LinkButton className="CanelaDraftsMenu-all" href={app.route('user.drafts', { username: user.slug() })}>
          {t('composer.drafts.view_all', { count: draftCount() })}
        </LinkButton>
      );
    }

    return items;
  }
}
