/*
 * Banner de anúncio global — o "tópico-banner": uma faixa acima
 * do conteúdo, em todas as páginas, com um botão de fechar.
 *
 * Fechar vale para o anúncio, não para sempre: o id dispensado fica no
 * localStorage, e o admin troca o id (o painel faz isso sozinho quando o
 * texto muda) para o banner voltar a aparecer para todo mundo.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';

import { forumBool, t } from '../../utils/settings';

const STORAGE_KEY = 'canela.bannerDismissed';

/** Sem id definido no admin, o próprio HTML identifica o anúncio. */
function bannerId(html: string): string {
  const configured = String(app.forum.attribute('canelaBannerId') || '').trim();

  if (configured) return configured;

  let hash = 0;
  for (let index = 0; index < html.length; index++) hash = (Math.imul(31, hash) + html.charCodeAt(index)) | 0;

  return `h${(hash >>> 0).toString(36)}`;
}

function dismissedId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

class AnnouncementBanner extends Component {
  /** Fechado nesta visita, mesmo se o localStorage estiver bloqueado. */
  closed = false;

  view(): Mithril.Children {
    const html = String(app.forum.attribute('canelaBannerHtml') || '');

    if (!forumBool('canelaBannerEnabled', true) || !html || this.closed) return null;

    const id = bannerId(html);

    if (dismissedId() === id) return null;

    return (
      <div className="CanelaBanner" role="region" aria-label={t('extras.banner.label')}>
        <div className="CanelaBanner-body Post-body">{m.trust(html)}</div>
        <Button
          className="Button Button--icon Button--link CanelaBanner-close"
          icon="fas fa-times"
          aria-label={t('extras.banner.dismiss')}
          title={t('extras.banner.dismiss')}
          onclick={() => this.dismiss(id)}
        />
      </div>
    );
  }

  dismiss(id: string): void {
    this.closed = true;

    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Sem armazenamento, fecha só até recarregar a página.
    }
  }
}

export default function installBanner(): void {
  extend(app as any, 'mount', function () {
    const content = document.getElementById('content');

    if (!content?.parentElement || document.getElementById('canela-banner')) return;

    // Um nó próprio, irmão do #content: o roteador redesenha o #content a cada
    // página, e o banner continua onde está entre uma e outra.
    const root = document.createElement('div');
    root.id = 'canela-banner';
    root.className = 'CanelaBanner-root';
    content.parentElement.insertBefore(root, content);

    m.mount(root, AnnouncementBanner);
  });
}
