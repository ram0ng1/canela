/*
 * O fundo da página, escolhido no admin (src/Backgrounds): o do fórum e o das
 * páginas de entrar/cadastrar. Mora em classes no <html> (`CanelaBg--<estilo>`)
 * e, com imagem, na variável `--cn-bg-image`. O PreBootShell aplica o mesmo
 * antes da primeira pintura; aqui ele é refeito no boot e trocado ao entrar e
 * sair das páginas de entrar/cadastrar.
 */
import app from 'flarum/forum/app';

import { previewState } from './preview';

export type BackgroundStyle = 'tinted' | 'gradient' | 'solid' | 'plain' | 'image';
export type BackgroundContext = 'forum' | 'auth';

const STYLES: BackgroundStyle[] = ['tinted', 'gradient', 'solid', 'plain', 'image'];

function attr(name: string): string {
  return String(app.forum?.attribute(name) ?? '');
}

function asStyle(value: string, fallback: BackgroundStyle): BackgroundStyle {
  return (STYLES as string[]).includes(value) ? (value as BackgroundStyle) : fallback;
}

function imageUrl(path: string): string | null {
  if (!path) return null;

  return `${attr('assetsBaseUrl').replace(/\/$/, '')}/${path}`;
}

export function forumBackground(): { style: BackgroundStyle; image: string | null } {
  const style = asStyle(previewState()?.forumBackground ?? attr('canelaForumBackground'), 'tinted');

  return { style, image: style === 'image' ? imageUrl(attr('canelaForumBackgroundImage')) : null };
}

export function authBackground(): { style: BackgroundStyle; image: string | null } {
  const value = previewState()?.authBackground ?? attr('canelaAuthBackground');

  if (!(STYLES as string[]).includes(value)) return forumBackground();

  const style = value as BackgroundStyle;

  return { style, image: style === 'image' ? imageUrl(attr('canelaAuthBackgroundImage')) : null };
}

export function applyBackground(context: BackgroundContext): void {
  const { style, image } = context === 'auth' ? authBackground() : forumBackground();
  const root = document.documentElement;

  STYLES.forEach((name) => root.classList.toggle(`CanelaBg--${name}`, name === style && (name !== 'image' || !!image)));

  // Imagem escolhida e ainda não enviada: fica o liso, sem fundo quebrado.
  if (style === 'image' && !image) root.classList.add('CanelaBg--plain');

  if (image) root.style.setProperty('--cn-bg-image', `url(${JSON.stringify(image)})`);
  else root.style.removeProperty('--cn-bg-image');
}
