/*
 * fof/discussion-thumbnail na lista do tema.
 *
 * A extensão troca o avatar do autor pela miniatura, mas a lista do tema
 * nem desenha esse avatar (os postadores ficam numa coluna).
 * Então a miniatura vira um item próprio, antes do título; no celular ela ocupa o lugar do
 * avatar de 48px.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Link from 'flarum/common/components/Link';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { thirdParty } from './settings';

export default function installThumbnails(): void {
  extend(DiscussionListItem.prototype, 'contentItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!thirdParty.thumbnails()) return;

    // Os resultados do modal de busca (MinimalDiscussionListItem) continuam com o avatar.
    if (String(this.elementAttrs().className || '').includes('MinimalDiscussionListItem')) return;

    const discussion = this.attrs.discussion;
    const src = discussion.attribute('customThumbnail');

    if (!src) return;

    items.add(
      'canelaThumbnail',
      <Link href={app.route.discussion(discussion)} className="CanelaTopicThumbnail" tabindex="-1" aria-hidden="true">
        <img src={src} alt="" loading="lazy" decoding="async" />
      </Link>,
      90
    );
  });
}
