import app from 'flarum/forum/app';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';

/**
 * Base das páginas Sobre, Usuários e Grupos: o cartão do PageStructure (sem a
 * coluna lateral — a navegação está na barra global), o título da aba e o
 * histórico.
 *
 * Desligado o recurso no admin, o servidor já responde 404 a quem chega pelo
 * endereço; esta guarda cobre quem já estava com o fórum aberto quando a opção
 * mudou.
 */
export default abstract class CommunityPage<Attrs extends IPageAttrs = IPageAttrs> extends Page<Attrs> {
  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.bodyClass = 'App--canelaCommunity';

    const title = this.title();

    app.history.push(this.attrs.routeName, title);
    app.setTitle(title);
    app.setTitleCount(0);
  }

  view(): Mithril.Children {
    return (
      <PageStructure className={classList('CanelaCommunityPage', this.className())}>
        {this.enabled() ? this.content() : <p className="CanelaCommunity-empty">{this.unavailableText()}</p>}
      </PageStructure>
    );
  }

  /** Por que a página não abre (recurso desligado, por padrão). */
  unavailableText(): string {
    return t('community.unavailable');
  }

  abstract title(): string;

  abstract className(): string;

  abstract enabled(): boolean;

  abstract content(): Mithril.Children;
}
