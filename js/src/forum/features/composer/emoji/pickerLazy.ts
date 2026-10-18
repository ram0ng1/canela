/*
 * O seletor de emoji é um chunk sob demanda: os botões chamam estas versões,
 * e o ponteiro ou o foco no botão já pede o chunk (o clique quase sempre o
 * encontra pronto). Os dados dos emoji são outro chunk, que o seletor pede.
 */
import { once } from '../../../utils/chunkGate';

const load = once(() => import('./EmojiPicker'));

export function preloadEmojiPicker(): void {
  load().catch(() => {});
}

export function openEmojiPicker(anchor: HTMLElement, onselect: (emoji: string) => void): void {
  load().then((picker) => picker.openEmojiPicker(anchor, onselect));
}
