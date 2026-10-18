import app from 'flarum/forum/app';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

import AboutNav, { guidelinesEnabled } from './AboutNav';
import CommunityPage from './CommunityPage';
import { t } from '../../utils/settings';

/**
 * As "Diretrizes" do Discourse (/guidelines, e /faq como apelido): as abas do
 * Sobre e o texto, do admin ou o padrão do tema, renderizado no servidor.
 */
export default class GuidelinesPage extends CommunityPage {
  html: string | null = null;
  failed = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    if (this.enabled()) this.load();
  }

  title(): string {
    return t('community.guidelines.title');
  }

  className(): string {
    return 'CanelaGuidelinesPage';
  }

  enabled(): boolean {
    return guidelinesEnabled();
  }

  load(): void {
    app
      .request<{ html: string | null }>({
        method: 'GET',
        url: `${(app.forum.attribute<string>('apiUrl') || '/api').replace(/\/+$/, '')}/canela-guidelines`,
      })
      .then((data) => (this.html = data?.html || ''))
      .catch(() => (this.failed = true))
      .finally(() => m.redraw());
  }

  content(): Mithril.Children {
    let body: Mithril.Children;

    if (this.failed) body = <p className="CanelaCommunity-empty">{t('community.load_error')}</p>;
    else if (this.html === null) body = <LoadingIndicator display="block" />;
    // O texto é do admin (ou o padrão do tema), já renderizado no servidor.
    else body = <div className="CanelaGuidelines-body CanelaAbout-text Post-body">{m.trust(this.html)}</div>;

    return (
      <div className="CanelaAbout CanelaGuidelines">
        {/* Como no Discourse, sem título próprio: a aba ativa diz onde se está, e o texto começa no primeiro título dele. */}
        <header className="CanelaAbout-header">{AboutNav('canela.guidelines')}</header>
        {body}
      </div>
    );
  }
}
