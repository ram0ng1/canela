/*
 * A pré-visualização do admin: os links "Pré-visualizar" abrem o fórum com
 * `?canelaPreview=<rascunho>` (o leiaute, os fundos e os textos ainda não
 * aplicados, em JSON e base64). Só vale para administradores, e só nesta aba:
 * nada é salvo, e um aviso no pé da tela lembra disso. Para qualquer outra
 * pessoa o parâmetro é ignorado (um link montado não muda o que ela vê).
 */
import app from 'flarum/forum/app';

import { t } from '../utils/settings';

export interface PreviewState {
  layout?: string;
  forumBackground?: string;
  authBackground?: string;
  texts?: Record<string, string>;
}

const PARAM = 'canelaPreview';

let state: PreviewState | null = null;

export function previewState(): PreviewState | null {
  return state;
}

/** O texto do rascunho (para o atributo dado), ou `undefined` sem pré-visualização. */
export function previewText(attribute: string): string | undefined {
  const texts = state?.texts;

  return texts && Object.prototype.hasOwnProperty.call(texts, attribute) ? String(texts[attribute] ?? '') : undefined;
}

export function decodePreview(value: string): PreviewState | null {
  try {
    const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));

    return parsed && typeof parsed === 'object' ? (parsed as PreviewState) : null;
  } catch {
    return null;
  }
}

/** Lê o parâmetro uma vez, no boot (depois da sessão). */
export function readPreview(): void {
  const value = new URLSearchParams(window.location.search).get(PARAM);

  if (!value || !(app.session.user as any)?.isAdmin?.()) return;

  state = decodePreview(value);

  if (state) showBanner();
}

function showBanner(): void {
  const banner = document.createElement('div');
  banner.className = 'CanelaPreviewBanner';
  banner.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.textContent = t('preview.banner');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'CanelaPreviewBanner-close';
  close.textContent = t('preview.close');
  // Aberta pelo admin, a aba fecha; aberta à mão, volta à página sem o rascunho.
  close.onclick = () => {
    window.close();
    setTimeout(() => window.location.assign(window.location.pathname), 150);
  };

  banner.append(text, close);
  document.body.appendChild(banner);
}
