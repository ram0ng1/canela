/*
 * Posts de evento (trancou, fixou, renomeou, convidou…) como uma "ação
 * pequena": numa linha só, o ícone pequeno num círculo, o avatar de quem
 * fez e o texto em cinza com o nome em negrito. O toggle `topic_event_posts`
 * do admin os oculta.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Avatar from 'flarum/common/components/Avatar';
import EventPost from 'flarum/forum/components/EventPost';
import type Mithril from 'mithril';

import { categoryBadge, labelBadge, type CanelaTag } from '../utils/tags';

/**
 * O badge de cada tag, como na lista: o símbolo da categoria ou o ícone da
 * etiqueta, e o nome. A subcategoria vai sozinha (sem o pai na frente): o
 * aviso é uma linha só.
 */
function tagBadge(tag: CanelaTag): Mithril.Children {
  return tag.position() === null ? labelBadge(tag) : categoryBadge(tag);
}

/** "A, B e C", com as vírgulas e o "e" do idioma do fórum. */
function joined(tags: CanelaTag[]): Mithril.Children[] {
  const badges = tags.map(tagBadge);

  try {
    const locale = (app.data as any).locale || document.documentElement.lang || 'en';
    // O ListFormat não está nas tipagens do TypeScript que o Flarum usa.
    const parts: Array<{ type: string; value: string }> = new (Intl as any).ListFormat(locale, { type: 'conjunction' }).formatToParts(
      tags.map((tag) => tag.name())
    );
    let index = 0;

    return parts.map((part) => (part.type === 'element' ? badges[index++] : part.value));
  } catch {
    return badges.flatMap((badge, i) => (i === 0 ? [badge] : [', ', badge]));
  }
}

/**
 * "Fulano adicionou a tag ▪ Migração e removeu a tag WordPress": os badges do
 * tema no lugar das caixas coloridas do flarum/tags, e o artigo antes ("a
 * tag", "as tags") em vez do "Migração tag" da tradução dele.
 */
function installTaggedPost(): void {
  override('ext:flarum/tags/forum/components/DiscussionTaggedPost', 'descriptionData', function (this: any, original: () => Record<string, any>) {
    const data = original();
    const describe = (tags: Array<CanelaTag | undefined> | undefined) => {
      const list = (tags || []).filter((tag): tag is CanelaTag => !!tag);

      return list.length ? app.translator.trans('ramon-canela.forum.topic.tagged_post', { count: list.length, tags: joined(list) }) : null;
    };

    const added = describe(this.tagsAdded);
    const removed = describe(this.tagsRemoved);

    if (added) data.tagsAdded = added;
    if (removed) data.tagsRemoved = removed;

    return data;
  });
}

export default function installEventPosts(): void {
  installTaggedPost();

  extend(EventPost.prototype, 'content', function (this: EventPost, content: Mithril.Children[]) {
    const user = this.attrs.post.user();

    if (!user || !Array.isArray(content)) return;

    // Depois do ícone, antes do texto.
    const index = content.findIndex((child: any) => child?.attrs?.className === 'EventPost-info');

    content.splice(index === -1 ? content.length : index, 0, <Avatar user={user} className="EventPost-avatar" />);
  });
}
