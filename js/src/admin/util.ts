/*
 * Helpers do painel do tema no admin: tradução, leitura das
 * configurações (que o core guarda como string), o POST que grava cada uma (com
 * o estado "Salvando…/Salvo" que o painel mostra) e o registro de dependências
 * entre as chaves.
 */
import app from 'flarum/admin/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

/** Os controles recebem attrs de formato livre (settingKey, label, help…). */
export type LooseAttrs = ComponentAttrs & Record<string, any>;

export abstract class AdminComponent<A extends LooseAttrs = LooseAttrs> extends Component<A> {}

export const settings = (): Record<string, any> => (app.data as any).settings;

export const trans = (key: string, params: Record<string, any> = {}): string => {
  // `extract: true` faz o Translator devolver string, e não filhos do Mithril.
  //
  // O try/catch é obrigatório: o formatter ICU lança SyntaxError quando uma
  // tradução da comunidade vem com tags desbalanceadas, e uma única string
  // quebrada derrubaria a página inteira de configurações.
  try {
    const translated = app.translator?.trans(key, params, true);
    if (typeof translated === 'string') return translated;
  } catch (error) {
    console.warn(`[canela] tradução inválida em "${key}".`, error);
  }

  return key;
};

export const getBool = (key: string): boolean => {
  const value = settings()[key];

  return value === true || value === 'true' || value === '1' || value === 1;
};

export const getStr = (key: string, fallback = ''): string => String(settings()[key] ?? fallback);

// ─────────────────────────────────────────────────────────────────────────────
// Gravação + "Salvo"
// ─────────────────────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Estado da gravação, lido pelo indicador da barra do painel. */
export const saveState: { status: SaveStatus; pending: number } = { status: 'idle', pending: 0 };

let idleTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * O card em que a pessoa mexeu por último (clique ou foco). O "Salvo" aparece
 * nele sem que cada controle precise saber em que card mora: o painel anota o
 * card no `pointerdown`/`focusin` e a gravação o marca quando termina.
 */
let lastCard: HTMLElement | null = null;

export const noteInteraction = (target: EventTarget | null): void => {
  const card = (target as HTMLElement | null)?.closest?.('.CanelaAdmin-card') as HTMLElement | null;
  if (card) lastCard = card;
};

const flashCard = (card: HTMLElement | null): void => {
  if (!card?.isConnected) return;

  // Atributo de dados, e não classe: o Mithril reescreve `className` quando o
  // card muda de estado, mas não toca num atributo que ele não conhece.
  card.setAttribute('data-saved', String(Date.now()));
  const stamp = card.getAttribute('data-saved');
  setTimeout(() => {
    if (card.getAttribute('data-saved') === stamp) card.removeAttribute('data-saved');
  }, 1800);
};

/** Grava direto na API — todos os controles do painel salvam sozinhos. */
export const saveSetting = (payload: Record<string, any>) => {
  const apiUrl = ((app.forum.attribute<string>('apiUrl') as string) || '/api').replace(/\/+$/, '');
  const card = lastCard;

  clearTimeout(idleTimer);
  saveState.pending++;
  saveState.status = 'saving';
  m.redraw();

  return app.request({ method: 'POST', url: `${apiUrl}/settings`, body: payload }).then(
    (response) => {
      saveState.pending = Math.max(0, saveState.pending - 1);
      if (saveState.pending === 0 && saveState.status !== 'error') {
        saveState.status = 'saved';
        idleTimer = setTimeout(() => {
          saveState.status = 'idle';
          m.redraw();
        }, 2500);
      }
      flashCard(card);
      m.redraw();

      return response;
    },
    (error) => {
      saveState.pending = Math.max(0, saveState.pending - 1);
      saveState.status = 'error';
      m.redraw();

      throw error;
    }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Extensões
// ─────────────────────────────────────────────────────────────────────────────

/** Nomes das extensões que o tema usa, para quando ela nem está instalada. */
const EXTENSION_NAMES: Record<string, string> = {
  'flarum-tags': 'Tags',
  'flarum-likes': 'Likes',
  'flarum-mentions': 'Mentions',
  'flarum-emoji': 'Emoji',
  'flarum-messages': 'Messages',
  'flarum-realtime': 'Realtime',
  'flarum-subscriptions': 'Subscriptions',
  'fof-drafts': 'FoF Drafts',
  'fof-reactions': 'FoF Reactions',
  'fof-best-answer': 'FoF Best Answer',
  'fof-polls': 'FoF Polls',
  'fof-links': 'FoF Links',
  'fof-upload': 'FoF Upload',
  'fof-discussion-thumbnail': 'FoF Discussion Thumbnail',
  'fof-formatting': 'FoF Formatting',
};

const installedExtension = (id: string): any => (app.data as any).extensions?.[id];

export const extensionName = (id: string): string => installedExtension(id)?.extra?.['flarum-extension']?.title || EXTENSION_NAMES[id] || id;

export const extensionInstalled = (id: string): boolean => !!installedExtension(id);

export const extensionOn = (id: string): boolean => isExtensionEnabled(id);

/** A primeira extensão da lista que está desligada (ou não instalada). */
export const missingExtension = (ids: string[] = []): string | null => ids.find((id) => !isExtensionEnabled(id)) ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// Dependências entre chaves
// ─────────────────────────────────────────────────────────────────────────────

interface DepEntry {
  deps: string[];
  extensions: string[];
  locked?: () => string | null;
}

/**
 * O que cada chave liga/desliga exige para valer. Os cards registram o próprio
 * `master` (ver index.tsx); os controles registram as suas ao desenhar. Assim
 * desligar a barra lateral apaga, em cascata, tudo que depende de algo que
 * depende dela.
 */
const DEPS: Record<string, DepEntry> = {};

export const toList = (value?: string | string[]): string[] => (value ? (Array.isArray(value) ? value : [value]) : []);

export const registerDeps = (key: string, entry: Partial<DepEntry>): void => {
  const current = DEPS[key] ?? { deps: [], extensions: [] };
  DEPS[key] = {
    deps: [...new Set([...current.deps, ...(entry.deps ?? [])])],
    extensions: [...new Set([...current.extensions, ...(entry.extensions ?? [])])],
    locked: entry.locked ?? current.locked,
  };
};

/** A chave está ligada E tudo de que ela depende também (recursivo). */
export const isOn = (key: string, seen: Set<string> = new Set()): boolean => {
  if (!getBool(key)) return false;
  if (seen.has(key)) return true;
  seen.add(key);

  const entry = DEPS[key];
  if (!entry) return true;
  if (missingExtension(entry.extensions)) return false;
  if (entry.locked?.()) return false;

  return entry.deps.every((dep) => isOn(dep, seen));
};

/** A primeira dependência desligada da lista, ou `null` quando todas valem. */
export const firstOff = (deps?: string | string[]): string | null => toList(deps).find((dep) => !isOn(dep)) ?? null;

/** Desenha os filhos só se as dependências valem — as opções que dependem de algo desligado somem. */
export const when = (deps: string | string[], children: any): any => (firstOff(deps) ? null : children);
