/*
 * As notas de rodapé (extend/cooked.php): o servidor marca as referências
 * `[^1]`, o começo das definições `[^1]: …` e as notas em linha `^[…]`; aqui
 * as referências ganham o número pela ordem ("[1]", "[2]"…), as definições saem do texto e o clique numa referência abre
 * a nota numa dica logo abaixo dela.
 *
 * Tudo dentro dos elementos que já existem (o post entra com m.trust): as
 * definições vão para um <span hidden> no próprio parágrafo, e o parágrafo
 * só com definições fica escondido.
 */
import { forumBool } from '../../utils/settings';

declare const s9e: { TextFormatter: { preview: (text: string, element: HTMLElement) => void } } | undefined;

export function footnotesOn(): boolean {
  return forumBool('canelaCookedBackend', false) && forumBool('canelaFootnotes', true);
}

let popover: HTMLElement | null = null;
let anchor: HTMLElement | null = null;

function closePopover(): void {
  popover?.remove();
  popover = null;
  anchor?.setAttribute('aria-expanded', 'false');
  anchor = null;
}

function onOutside(event: Event): void {
  const target = event.target as Node | null;

  if (popover && target && !popover.contains(target) && !anchor?.contains(target)) closePopover();
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') closePopover();
}

let listening = false;

function listen(): void {
  if (listening) return;

  listening = true;
  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('keydown', onKey);
  window.addEventListener('scroll', () => popover && closePopover(), { passive: true });
}

function openPopover(trigger: HTMLElement, content: Node): void {
  const same = anchor === trigger;

  closePopover();

  if (same) return;

  listen();

  popover = document.createElement('div');
  popover.className = 'CanelaFootnotePopover';
  popover.setAttribute('role', 'tooltip');
  popover.appendChild(content);
  document.body.appendChild(popover);

  anchor = trigger;
  trigger.setAttribute('aria-expanded', 'true');

  const rect = trigger.getBoundingClientRect();
  const width = popover.offsetWidth;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));

  popover.style.left = `${left + window.scrollX}px`;
  popover.style.top = `${rect.bottom + window.scrollY + 6}px`;
}

/** O texto da nota em linha, com o markdown quando o formatador do navegador está à mão. */
function inlineContent(text: string): Node {
  const holder = document.createElement('div');

  if (typeof s9e !== 'undefined' && s9e?.TextFormatter?.preview) {
    try {
      s9e.TextFormatter.preview(text, holder);
      return holder;
    } catch {
      // Sem o formatador: texto puro.
    }
  }

  holder.textContent = text;

  return holder;
}

/**
 * Cada definição: do marcador até o próximo marcador (ou o fim do parágrafo).
 * O conteúdo sai do texto para um <span hidden> no mesmo parágrafo.
 */
function collectDefinitions(body: HTMLElement): Map<string, HTMLElement> {
  const definitions = new Map<string, HTMLElement>();

  body.querySelectorAll<HTMLElement>('p').forEach((paragraph) => {
    const markers = Array.from(paragraph.querySelectorAll<HTMLElement>(':scope > .CanelaFootnote-def'));

    if (!markers.length) return;

    markers.forEach((marker, index) => {
      const next = markers[index + 1] || null;
      const range = document.createRange();

      range.setStartAfter(marker);
      if (next) range.setEndBefore(next);
      else range.setEnd(paragraph, paragraph.childNodes.length);

      const store = document.createElement('span');
      store.className = 'CanelaFootnote-content';
      store.hidden = true;
      store.appendChild(range.extractContents());

      // A quebra de linha entre duas definições fica de fora.
      store.querySelectorAll(':scope > br:last-child').forEach((br) => br.remove());

      marker.after(store);
      marker.hidden = true;
      definitions.set(marker.dataset.fn || '', store);
    });

    // O parágrafo só com definições some (o que sobrou é espaço).
    const rest = Array.from(paragraph.childNodes).filter(
      (node) =>
        !(
          node instanceof HTMLElement &&
          (node.classList.contains('CanelaFootnote-def') || node.classList.contains('CanelaFootnote-content') || node.tagName === 'BR')
        ) && (node.textContent || '').trim() !== ''
    );

    if (!rest.length) paragraph.classList.add('CanelaFootnote-definitions');
  });

  return definitions;
}

/** O que ainda não foi tratado. Um post editado troca o HTML inteiro, então ou tudo já foi, ou nada. */
const PENDING =
  '.CanelaFootnote-ref:not(.CanelaFootnote--ready), .CanelaFootnote-inline:not(.CanelaFootnote--ready), .CanelaFootnote-def:not([hidden])';

export function decorateFootnotes(body: HTMLElement): void {
  if (!footnotesOn() || !body.querySelector(PENDING)) return;

  const refs = body.querySelectorAll<HTMLElement>('.CanelaFootnote-ref, .CanelaFootnote-inline');

  const definitions = collectDefinitions(body);
  const numbers = new Map<string, number>();
  let counter = 0;

  refs.forEach((ref) => {
    const inline = ref.classList.contains('CanelaFootnote-inline');
    const label = inline ? '' : ref.dataset.fn || '';
    const definition = inline ? null : definitions.get(label);

    // Referência sem definição: fica como está ("[x]").
    if (!inline && !definition) return;

    let number = inline ? 0 : numbers.get(label) || 0;

    if (!number) {
      number = ++counter;
      if (!inline) numbers.set(label, number);
    }

    const trigger = document.createElement('a');
    trigger.href = '#';
    trigger.className = 'CanelaFootnote-trigger';
    trigger.textContent = `[${number}]`;
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const content = inline ? inlineContent(ref.dataset.text || '') : definition!.cloneNode(true);

      if (content instanceof HTMLElement) content.hidden = false;

      openPopover(trigger, content);
    });

    ref.classList.add('CanelaFootnote--ready');
    ref.replaceChildren(trigger);
  });
}
