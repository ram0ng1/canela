/*
 * A casca do painel: os grupos à esquerda (no celular, uma faixa rolável no
 * topo), a busca, o indicador "Salvando…/Salvo" e os cards do grupo ativo.
 *
 * Dependências: cada card com `master` registra o que a chave dele exige
 * (`dependsOn`, `extensions`, `lockedBy`). Um card cujo `dependsOn` está
 * desligado sai do grupo e entra na nota "Ocultos" do fim, com o link para o
 * card que falta ligar; na busca ele aparece como um aviso compacto, para a
 * busca achar tudo o que existe.
 */
import type { CardDef, GroupKey } from '../types';
import { firstOff, getBool, noteInteraction, registerDeps, saveState, toList, trans } from '../util';
import { AdminCard, lockReason } from './AdminCard';

const KEY = 'ramon-canela.admin.settings';
const SHELL = `${KEY}.shell`;

export interface GroupDef {
  key: GroupKey;
  icon: string;
  label: () => string;
  description: () => string;
}

export const GROUPS: GroupDef[] = [
  {
    key: 'appearance',
    icon: 'fas fa-palette',
    label: () => trans(`${KEY}.group_appearance`),
    description: () => trans(`${SHELL}.group_appearance_desc`),
  },
  {
    key: 'navigation',
    icon: 'fas fa-table-columns',
    label: () => trans(`${SHELL}.group_navigation`),
    description: () => trans(`${SHELL}.group_navigation_desc`),
  },
  {
    key: 'auth',
    icon: 'fas fa-right-to-bracket',
    label: () => trans(`${SHELL}.group_auth`),
    description: () => trans(`${SHELL}.group_auth_desc`),
  },
  {
    key: 'list',
    icon: 'fas fa-list',
    label: () => trans(`${KEY}.group_list`),
    description: () => trans(`${SHELL}.group_list_desc`),
  },
  {
    key: 'topic',
    icon: 'far fa-comments',
    label: () => trans(`${KEY}.group_topic`),
    description: () => trans(`${SHELL}.group_topic_desc`),
  },
  {
    key: 'composer',
    icon: 'fas fa-pen-to-square',
    label: () => trans(`${KEY}.group_composer`),
    description: () => trans(`${SHELL}.group_composer_desc`),
  },
  {
    key: 'templates',
    icon: 'fas fa-file-lines',
    label: () => trans(`${SHELL}.group_templates`),
    description: () => trans(`${SHELL}.group_templates_desc`),
  },
  {
    key: 'onebox',
    icon: 'fas fa-link',
    label: () => trans(`${SHELL}.group_onebox`),
    description: () => trans(`${SHELL}.group_onebox_desc`),
  },
  {
    key: 'people',
    icon: 'far fa-user',
    label: () => trans(`${SHELL}.group_people`),
    description: () => trans(`${SHELL}.group_people_desc`),
  },
  {
    key: 'messages',
    icon: 'far fa-envelope',
    label: () => trans(`${SHELL}.group_messages`),
    description: () => trans(`${SHELL}.group_messages_desc`),
  },
  {
    key: 'community',
    icon: 'fas fa-users',
    label: () => trans(`${KEY}.group_community`),
    description: () => trans(`${SHELL}.group_community_desc`),
  },
  {
    key: 'moderation',
    icon: 'fas fa-shield-halved',
    label: () => trans(`${SHELL}.group_moderation`),
    description: () => trans(`${SHELL}.group_moderation_desc`),
  },
  {
    key: 'bugreports',
    icon: 'fas fa-bug',
    label: () => trans(`${SHELL}.group_bugreports`),
    description: () => trans(`${SHELL}.group_bugreports_desc`),
  },
  {
    key: 'system',
    icon: 'fas fa-robot',
    label: () => trans(`${SHELL}.group_system`),
    description: () => trans(`${SHELL}.group_system_desc`),
  },
  {
    key: 'integrations',
    icon: 'fas fa-puzzle-piece',
    label: () => trans(`${SHELL}.group_integrations`),
    description: () => trans(`${SHELL}.group_integrations_desc`),
  },
  {
    key: 'ai',
    icon: 'fas fa-wand-magic-sparkles',
    label: () => trans(`${KEY}.group_ai`),
    description: () => trans(`${SHELL}.group_ai_desc`),
  },
];

const TAB_STORAGE_KEY = 'canela.admin.tab';

export function createPanel(cards: CardDef[]): any {
  // O que cada chave mestra exige: assim um `dependsOn` que aponta para ela
  // herda, em cascata, as dependências dela.
  for (const card of cards) {
    if (card.master) registerDeps(card.master, { deps: toList(card.dependsOn), extensions: card.extensions ?? [], locked: card.lockedBy });
  }

  const groupLabel = (key: GroupKey) => GROUPS.find((group) => group.key === key)?.label() ?? '';

  /** O card cuja chave mestra é `key` — o alvo de "Depende de …". */
  const ownerOf = (key: string): CardDef | undefined => cards.find((card) => card.master === key);

  const depTitle = (key: string): string => ownerOf(key)?.title() ?? key;

  let activeGroup: GroupKey = (() => {
    try {
      const saved = localStorage.getItem(TAB_STORAGE_KEY) as GroupKey | null;
      if (saved && GROUPS.some((group) => group.key === saved)) return saved;
    } catch {
      // localStorage bloqueado: segue no primeiro grupo.
    }
    return 'appearance';
  })();

  let query = '';

  const setGroup = (key: GroupKey) => {
    activeGroup = key;
    query = '';
    try {
      localStorage.setItem(TAB_STORAGE_KEY, key);
    } catch {
      // Sem persistência é só uma conveniência a menos.
    }
  };

  /** Leva ao card (trocando de grupo se preciso) e o destaca por um instante. */
  const jumpTo = (target: CardDef | undefined) => {
    // Se o card que falta ligar também está oculto, sobe a cadeia até o
    // primeiro que está à vista.
    let card = target;
    for (let dep = card && firstOff(card.dependsOn); card && dep; dep = card && firstOff(card.dependsOn)) card = ownerOf(dep);
    if (!card) return;
    setGroup(card.group);
    m.redraw.sync();

    const element = document.getElementById(`CanelaAdmin-card-${card.id}`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.setAttribute('data-flash', '1');
    setTimeout(() => element.removeAttribute('data-flash'), 1600);
  };

  // No celular os grupos viram uma faixa rolável: o ativo precisa estar à
  // vista. Só rola quando o grupo muda, não a cada redesenho.
  let revealed: GroupKey | null = null;
  const revealActive = (nav: HTMLElement) => {
    if (revealed === activeGroup) return;
    revealed = activeGroup;
    const item = nav.querySelector('.is-active') as HTMLElement | null;
    if (item && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = item.offsetLeft - nav.offsetLeft - 16;
  };

  const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const matches = (card: CardDef, needle: string): boolean =>
    normalize(`${card.title()} ${card.description?.() ?? ''} ${card.keywords} ${groupLabel(card.group)}`).includes(needle);

  const featureCount = (key: GroupKey) => {
    // Só os recursos à vista: um card oculto por dependência não conta no total.
    const features = cards.filter((card) => card.group === key && card.master && !firstOff(card.dependsOn));
    const active = features.filter((card) => !lockReason(card) && getBool(card.master!));

    return { total: features.length, active: active.length };
  };

  const SaveIndicator: any = {
    view() {
      const { status } = saveState;
      const text =
        status === 'saving'
          ? trans(`${SHELL}.saving`)
          : status === 'saved'
            ? trans(`${SHELL}.saved_all`)
            : status === 'error'
              ? trans(`${SHELL}.save_error`)
              : trans(`${SHELL}.autosave`);
      const icon =
        status === 'saving'
          ? 'fas fa-circle-notch fa-spin'
          : status === 'error'
            ? 'fas fa-triangle-exclamation'
            : status === 'saved'
              ? 'fas fa-check'
              : 'fas fa-cloud';

      return (
        <span className={`CanelaAdmin-save is-${status}`} role="status" aria-live="polite">
          <i className={icon} aria-hidden="true" />
          {text}
        </span>
      );
    },
  };

  /** Card que depende de algo desligado, na busca: o aviso e o atalho para ligar. */
  const HiddenStub: any = {
    view({ attrs: { card, dep } }: any) {
      return (
        <div className="CanelaAdmin-stub">
          <span className="CanelaAdmin-card-icon">
            <i className={card.icon} aria-hidden="true" />
          </span>
          <div className="CanelaAdmin-stub-text">
            <strong>{card.title()}</strong>
            <span className="CanelaAdmin-card-group">{groupLabel(card.group)}</span>
            <span className="CanelaAdmin-stub-reason">{trans(`${SHELL}.depends_on`, { name: depTitle(dep) })}</span>
          </div>
          <button type="button" className="Button Button--text CanelaAdmin-stub-go" onclick={() => jumpTo(ownerOf(dep))}>
            {trans(`${SHELL}.go_enable`)} <i className="fas fa-arrow-right" aria-hidden="true" />
          </button>
        </div>
      );
    },
  };

  return {
    view() {
      const needle = normalize(query.trim());
      const searching = needle.length > 0;
      const group = GROUPS.find((g) => g.key === activeGroup) ?? GROUPS[0];
      const pool = searching ? cards.filter((card) => matches(card, needle)) : cards.filter((card) => card.group === group.key);
      const shown = pool.filter((card) => !firstOff(card.dependsOn));
      const hidden = pool.filter((card) => firstOff(card.dependsOn));

      return (
        <div
          className="CanelaAdmin"
          onpointerdown={(event: any) => {
            event.redraw = false;
            noteInteraction(event.target);
          }}
          onfocusin={(event: any) => {
            event.redraw = false;
            noteInteraction(event.target);
          }}
        >
          <aside className="CanelaAdmin-side">
            <div className="CanelaAdmin-search">
              <i className="fas fa-magnifying-glass" aria-hidden="true" />
              <input
                type="search"
                className="CanelaAdmin-searchInput"
                value={query}
                placeholder={trans(`${KEY}.search_placeholder`)}
                aria-label={trans(`${KEY}.search_placeholder`)}
                oninput={(event: InputEvent) => {
                  query = (event.target as HTMLInputElement).value;
                }}
              />
              {!!query && (
                <button
                  type="button"
                  className="CanelaAdmin-searchClear"
                  aria-label={trans(`${KEY}.search_clear`)}
                  onclick={() => {
                    query = '';
                  }}
                >
                  <i className="fas fa-xmark" aria-hidden="true" />
                </button>
              )}
            </div>

            <nav
              className="CanelaAdmin-nav"
              aria-label={trans(`${KEY}.groups_aria`)}
              oncreate={(vnode: any) => revealActive(vnode.dom)}
              onupdate={(vnode: any) => revealActive(vnode.dom)}
            >
              {GROUPS.map((g) => {
                const isActive = !searching && g.key === activeGroup;
                const count = featureCount(g.key);

                return (
                  <button
                    key={g.key}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    className={`CanelaAdmin-navItem${isActive ? ' is-active' : ''}`}
                    onclick={() => setGroup(g.key)}
                  >
                    <i className={g.icon} aria-hidden="true" />
                    <span className="CanelaAdmin-navLabel">{g.label()}</span>
                    {count.total > 0 && (
                      <span className="CanelaAdmin-navCount" title={trans(`${SHELL}.active_count`, { active: count.active, total: count.total })}>
                        {count.active}/{count.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="CanelaAdmin-main">
            <div className="CanelaAdmin-head">
              <div className="CanelaAdmin-headText">
                <h2 className="CanelaAdmin-headTitle">
                  {searching ? (
                    trans(`${SHELL}.search_results`, { query: query.trim() })
                  ) : (
                    <>
                      <i className={group.icon} aria-hidden="true" />
                      {group.label()}
                    </>
                  )}
                </h2>
                {!searching && <p className="CanelaAdmin-headDesc">{group.description()}</p>}
              </div>
              <SaveIndicator />
            </div>

            {pool.length === 0 ? (
              <p className="CanelaAdmin-empty">{trans(`${KEY}.search_empty`)}</p>
            ) : (
              <div className="CanelaAdmin-cards">
                {shown.map((card) => (
                  <AdminCard key={card.id} card={card} groupLabel={searching ? groupLabel(card.group) : undefined} />
                ))}
                {searching && hidden.map((card) => <HiddenStub key={`stub-${card.id}`} card={card} dep={firstOff(card.dependsOn)} />)}
              </div>
            )}

            {!searching && hidden.length > 0 && (
              <div className="CanelaAdmin-hidden">
                <p className="CanelaAdmin-hidden-title">
                  <i className="far fa-eye-slash" aria-hidden="true" />
                  {trans(`${SHELL}.hidden_title`)}
                </p>
                <ul>
                  {hidden.map((card) => {
                    const dep = firstOff(card.dependsOn)!;

                    return (
                      <li key={card.id}>
                        <span>
                          <i className={card.icon} aria-hidden="true" /> {card.title()}
                        </span>
                        <button type="button" className="CanelaAdmin-hidden-link" onclick={() => jumpTo(ownerOf(dep))}>
                          {trans(`${SHELL}.needs`, { name: depTitle(dep) })}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    },
  };
}
