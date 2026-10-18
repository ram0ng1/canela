/*
 * Copiar um link para a área de transferência, com aviso. O Clipboard API só
 * existe em contexto seguro; fora dele (http em rede local, por exemplo) vale
 * o velho execCommand com um campo temporário.
 */
import app from 'flarum/forum/app';

import { t } from './settings';

function legacyCopy(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();

  let copied = false;

  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  field.remove();

  return copied;
}

export function copyLink(url: string): void {
  const done = () => app.alerts.show({ type: 'success' }, t('topic.link_copied'));

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(done, () => legacyCopy(url) && done());
  } else if (legacyCopy(url)) {
    done();
  }
}

/**
 * No celular, a folha de compartilhamento do sistema (como o Discourse faz);
 * no computador, copiar o link.
 */
export function shareLink(url: string, title: string): void {
  if (app.screen() === 'phone' && typeof navigator.share === 'function') {
    navigator.share({ url, title }).catch(() => {});
    return;
  }

  copyLink(url);
}
