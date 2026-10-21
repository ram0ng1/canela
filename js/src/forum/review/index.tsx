/*
 * "Revisar": a página /flags do flarum/flags vira a fila de revisão, dentro
 * do cartão do tema.
 *
 * Pelo nome do módulo, como o modal de sinalizar: o tema não importa nada do
 * flarum/flags, que pode estar desligado. O `oninit` original também é
 * trocado: ele carregaria o `app.flags` (só posts e autores), e a fila faz a
 * própria requisição, com o post inteiro.
 */
import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';
import Page from 'flarum/common/components/Page';
import PageStructure from 'flarum/forum/components/PageStructure';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

import { lazyComponent } from '../utils/lazy';
import { isExtensionEnabled, t } from '../utils/settings';

// A fila vai num chunk próprio: só a moderação abre o /flags.
const ReviewQueue = lazyComponent(
  () => import('./ReviewQueue').then((module) => module.default),
  () => <LoadingIndicator />
);

const FLAGS_PAGE = 'ext:flarum/flags/forum/components/FlagsPage';

export default function installReview(): void {
  if (!isExtensionEnabled('flarum-flags')) return;

  override(FLAGS_PAGE as any, 'oninit', function (this: any, _original: unknown, vnode: any) {
    Page.prototype.oninit.call(this, vnode);

    const title = t('review.title');

    app.history.push('flags', title);
    app.setTitle(title);
    app.setTitleCount(0);

    this.bodyClass = 'App--flags App--canelaReview';
  });

  override(FLAGS_PAGE as any, 'view', function () {
    return (
      <PageStructure className="FlagsPage CanelaReviewPage">
        <ReviewQueue />
      </PageStructure>
    );
  });
}
