/*
 * Destaques coloridos pela tag (como o tema avocado): numa página de tag, ou
 * numa discussão, a cor de destaque do tema passa a ser a cor da tag primária
 * — botões primários, links, aba ativa, anel de foco, fundo tingido, tudo o
 * que deriva de `--cn-accent`.
 *
 * Como toda a paleta do tema sai de uma variável só, basta trocá-la no
 * `<html>`: os tokens derivados (`oklch(from var(--cn-accent) …)`) se
 * recalculam sozinhos. Fora de tag/discussão, a variável sai e vale a cor
 * primária do fórum de novo.
 */
import app from 'flarum/forum/app';
import DiscussionPage from 'flarum/forum/components/DiscussionPage';
import IndexPage from 'flarum/forum/components/IndexPage';
import type Discussion from 'flarum/common/models/Discussion';

import { forumBool } from '../utils/settings';
import { currentTag, discussionTags, type CanelaTag } from '../utils/tags';

let applied: string | null = null;

/** A cor que vale para uma tag: a dela, ou a da mãe quando a filha não tem. */
function tagColor(tag: CanelaTag | null | undefined): string | null {
  if (!tag) return null;

  const own = tag.color();
  if (own) return own;

  const parent = tag.isChild() ? (tag.parent() as CanelaTag | null) : null;

  return parent?.color() || null;
}

/** A tag primária da discussão: a filha mais específica, ou a primeira primária. */
function primaryTagOf(discussion: Discussion): CanelaTag | null {
  const primaries = discussionTags(discussion).filter((tag) => tag.position() !== null);

  return primaries.find((tag) => tag.isChild()) ?? primaries[0] ?? null;
}

function activeColor(): string | null {
  if (!forumBool('canelaColoredAccents', true)) return null;

  if (app.current.matches(DiscussionPage)) {
    const discussion = app.current.get('discussion') as Discussion | null;

    return discussion ? tagColor(primaryTagOf(discussion)) : applied;
  }

  if (app.current.matches(IndexPage)) return tagColor(currentTag());

  return null;
}

/**
 * Texto sobre a cor: escuro quando a cor é clara (amarelo, lima…), para o
 * botão primário continuar legível — a mesma conta YIQ que o core usa.
 */
function textOn(hex: string): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));

  return (r * 299 + g * 587 + b * 114) / 1000 >= 160 ? '#1a1a1a' : '#ffffff';
}

/**
 * "Pintar o logo" (como o avocado): o logo vira só a forma, na cor de
 * destaque — e, com os destaques coloridos, na cor da tag. O CSS usa o
 * próprio arquivo do logo como máscara (`--cn-logo-mask`).
 */
function updateLogoTint(): void {
  const root = document.documentElement;
  const url = app.forum?.attribute<string>('logoUrl');
  const on = !!url && forumBool('canelaLogoColored', false);

  root.classList.toggle('Canela--logoTinted', on);

  if (on) root.style.setProperty('--cn-logo-mask', `url("${url!.replace(/"/g, '%22')}")`);
  else root.style.removeProperty('--cn-logo-mask');
}

export function updateColoredAccents(): void {
  updateLogoTint();

  const color = activeColor();

  if (color === applied) return;

  applied = color;
  const root = document.documentElement;

  if (color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
    root.style.setProperty('--cn-accent', color);
    root.style.setProperty('--primary-color', color);
    root.style.setProperty('--cn-accent-text', textOn(color));
    root.classList.add('Canela--colored');
  } else {
    root.style.removeProperty('--cn-accent');
    root.style.removeProperty('--primary-color');
    root.style.removeProperty('--cn-accent-text');
    root.classList.remove('Canela--colored');
  }
}

/**
 * Um componente montado à parte só para ser chamado a cada redraw: a troca
 * de página, a chegada da discussão e a mudança de tag passam todas por um.
 */
export function watchColoredAccents(): void {
  const slot = document.createElement('div');
  slot.hidden = true;
  document.body.appendChild(slot);

  m.mount(slot, {
    view: () => null,
    oncreate: updateColoredAccents,
    onupdate: updateColoredAccents,
  });
}
