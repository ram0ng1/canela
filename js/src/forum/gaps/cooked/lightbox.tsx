/*
 * O lightbox (PhotoSwipe): clicar numa imagem do post abre a
 * imagem grande sobre um fundo escuro, com as setas entre as imagens do mesmo
 * post, o contador "1 de 3", zoom (tecla Z), "Imagem original", "Baixar" e
 * Esc para fechar.
 *
 * Um ouvinte de clique no documento, e não um por imagem: os posts redesenham
 * o HTML (edição, realtime), e o ouvinte delegado não precisa ser refeito.
 * O lightbox mora num <div> próprio no body, fora do post, porque o conteúdo
 * do post corta o que transborda.
 */
import { gaps } from '../settings';
import { once } from '../../utils/chunkGate';

/** Onde as imagens ampliáveis moram: posts, prévias do editor e posts embutidos. */
const CONTAINERS = '.Post-body, .CanelaEmbeddedPost-body, .ComposerBody-preview, .Post-preview';
/** Imagens que não abrem: emojis, avatares e as miniaturas de oneboxes. */
const SKIP = 'img.emoji, .Avatar, .avatar, .UserMention img, .spoiler img, .CanelaSpoiler--blurred img';
/** Abaixo disso a imagem é um ícone, não uma foto. */
const MIN_SIZE = 48;

export interface Slide {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const loadView = once(() => import('./LightboxView'));

function preload(): void {
  loadView().catch(() => {});
}

export function openLightbox(slides: Slide[], index = 0): void {
  loadView().then((view) => view.openLightbox(slides, index));
}

/** O endereço da imagem cheia: o link em volta, se apontar para uma imagem. */
function fullSource(img: HTMLImageElement): string {
  const link = img.closest('a');

  if (link && linksToImage(link)) return link.href;

  return img.currentSrc || img.src;
}

function linksToImage(link: HTMLAnchorElement): boolean {
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(link.getAttribute('href') || '');
}

function isZoomable(img: HTMLImageElement): boolean {
  if (img.matches(SKIP) || img.closest(SKIP)) return false;

  // Uma imagem dentro de um link para uma página (e não para uma imagem)
  // continua sendo um link: o clique navega.
  const link = img.closest('a');
  if (link && link.getAttribute('href') && !linksToImage(link)) return false;

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  return !(width && height && width < MIN_SIZE && height < MIN_SIZE);
}

function slidesFor(img: HTMLImageElement): { slides: Slide[]; index: number } {
  const container = img.closest(CONTAINERS);
  const images = container ? Array.from(container.querySelectorAll<HTMLImageElement>('img')).filter(isZoomable) : [img];
  const list = images.length ? images : [img];

  return {
    slides: list.map((item) => ({
      src: fullSource(item),
      alt: item.getAttribute('alt') || item.getAttribute('title') || '',
      width: item.naturalWidth,
      height: item.naturalHeight,
    })),
    index: Math.max(0, list.indexOf(img)),
  };
}

function onDocumentClick(event: MouseEvent): void {
  if (!gaps.lightbox() || event.defaultPrevented) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const img = (event.target as HTMLElement | null)?.closest?.('img') as HTMLImageElement | null;

  if (!img || !img.closest(CONTAINERS) || !isZoomable(img)) return;

  event.preventDefault();
  event.stopPropagation();

  const { slides, index } = slidesFor(img);

  openLightbox(slides, index);
}

/** O ponteiro sobre uma imagem de post (ou o toque nela): o chunk desce antes do clique. */
function onPointerOver(event: Event): void {
  if (!gaps.lightbox()) return;

  const img = (event.target as HTMLElement | null)?.closest?.('img');

  if (!img || !img.closest(CONTAINERS)) return;

  document.removeEventListener('mouseover', onPointerOver);
  document.removeEventListener('touchstart', onPointerOver);
  preload();
}

export default function installLightbox(): void {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('mouseover', onPointerOver, { passive: true });
  document.addEventListener('touchstart', onPointerOver, { passive: true });
}
