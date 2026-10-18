import app from 'flarum/forum/app';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { badgesEnabled } from '../utils';
import { t } from '../../../utils/settings';

/**
 * Base de /badges e /badges/:id: o cartão do PageStructure sem a coluna
 * lateral (a navegação está na barra global), o título da aba e o histórico.
 *
 * Com os emblemas desligados o servidor já responde 404 a quem chega pelo
 * endereço; o aviso cobre quem estava com o fórum aberto quando a opção mudou.
 */
export default abstract class BadgesBasePage<Attrs extends IPageAttrs = IPageAttrs> extends Page<Attrs> {
  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.bodyClass = 'App--canelaBadges';

    app.history.push(this.attrs.routeName, this.title());
    this.updateTitle();
  }

  updateTitle(): void {
    app.setTitle(this.title());
    app.setTitleCount(0);
  }

  view(): Mithril.Children {
    return (
      <PageStructure className={classList('CanelaBadgesPage', this.className())}>
        {badgesEnabled() ? this.content() : <p className="CanelaBadges-empty">{t('badges.unavailable')}</p>}
      </PageStructure>
    );
  }

  abstract title(): string;

  abstract className(): string;

  abstract content(): Mithril.Children;
}
