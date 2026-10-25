/*
 * O menu do `@` e do `#` do flarum/mentions no desenho do tema: linhas de
 * borda a borda, o nome de usuário seguido do nome em
 * cinza (e o emoji de status), o grupo com o ícone de pessoas, a categoria com
 * o quadrado (o da subcategoria em duas cores, "Pai > Filha") e a etiqueta com
 * o ícone e a contagem "(x315)".
 *
 * Sem reescrever a extensão: cada peça é um `override` no módulo dela, pelo
 * nome (`ext:flarum/mentions/...`), e só vale com ela habilitada.
 *
 * O comportamento: o `@` ou o `#` sozinhos já abrem
 * a lista (quem participa do tópico primeiro), no máximo 6 pessoas e grupos e
 * 20 hashtags, sem as menções de post, abrindo acima do cursor quando cabe,
 * com as setas parando nas pontas e o mouse só realçando a linha.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import type Discussion from 'flarum/common/models/Discussion';
import type Group from 'flarum/common/models/Group';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { StatusEmoji } from '../features/profile';
import { categorySymbol, childSymbol, sortTags, type CanelaTag } from '../utils/tags';
import { isExtensionEnabled, t } from '../utils/settings';

const MODULE = 'ext:flarum/mentions/forum/mentionables/';

/**
 * O que o `@`/`#` sozinho vira: o mentions desiste quando o digitado é vazio
 * (`if (!matchTyped) return`), então um caractere invisível passa por ali e
 * casa com tudo. Tem um caractere só, e a busca na API só roda a partir de 2.
 */
const BARE = '​';

/** Os limites da lista: pessoas e grupos no `@`, hashtags no `#`. */
const AT_LIMIT = 6;
const HASH_LIMIT = 20;

/** Quantos posts do fim do tópico contam para "quem participa". */
const PARTICIPANT_POSTS = 60;

/**
 * Quem postou por último no tópico aberto (sem o leitor), para o `@`
 * sozinho. O mentions pede a lista a cada tecla: só os últimos ids do
 * tópico, lidos direto do store, e guardados enquanto o tópico for o mesmo.
 */
let participantsCache: { discussion: Discussion; count: number; users: User[] } | null = null;

function topicParticipants(): User[] {
  const discussion = app.current.get('discussion') as Discussion | undefined;

  if (!discussion) return [];

  const ids = discussion.postIds?.() || [];

  if (participantsCache && participantsCache.discussion === discussion && participantsCache.count === ids.length) return participantsCache.users;

  const seen = new Set<string>();
  const me = app.session.user?.id();
  const users: User[] = [];

  for (let i = ids.length - 1; i >= 0 && i >= ids.length - PARTICIPANT_POSTS; i--) {
    const user = app.store.getById<Post>('posts', ids[i])?.user();
    const id = user ? user.id() : undefined;

    if (!user || !id || id === me || seen.has(id)) continue;

    seen.add(id);
    users.push(user);
  }

  participantsCache = { discussion, count: ids.length, users };

  return users;
}

/** Categorias antes das etiquetas; entre as etiquetas, as mais usadas primeiro (guardado: as tags não mudam a cada tecla). */
let rankedCache: { size: number; tags: CanelaTag[] } | null = null;

function rankTags(tags: CanelaTag[]): CanelaTag[] {
  if (rankedCache && rankedCache.size === tags.length) return rankedCache.tags;

  const categories = sortTags(tags.filter((tag) => tag.position() !== null));
  const labels = tags
    .filter((tag) => tag.position() === null)
    .sort((a, b) => ((b as any).discussionCount?.() || 0) - ((a as any).discussionCount?.() || 0));

  rankedCache = { size: tags.length, tags: [...categories, ...labels] };

  return rankedCache.tags;
}

function userSuggestion(user: User): Mithril.Children {
  const name = user.displayName();

  return (
    <>
      <Avatar user={user} />
      <span className="username">{user.username()}</span>
      {name && name !== user.username() ? <span className="name">{name}</span> : null}
      {StatusEmoji(user, 'MentionsDropdown-status')}
    </>
  );
}

function groupSuggestion(group: Group): Mithril.Children {
  return (
    <>
      <Icon name="fas fa-users" className="MentionsDropdown-groupIcon" />
      <span className="username">{group.namePlural()}</span>
    </>
  );
}

function tagSuggestion(tag: CanelaTag): Mithril.Children {
  if (tag.position() === null) {
    const count: number = (tag as any).discussionCount?.() || 0;

    return (
      <>
        <Icon name="fas fa-tag" className="MentionsDropdown-tagIcon" />
        <span className="username">{tag.name()}</span>
        {count > 0 ? <span className="MentionsDropdown-meta">{t('composer.hashtags.tag_count', { count })}</span> : null}
      </>
    );
  }

  const parent = tag.isChild() ? (tag.parent() as CanelaTag | null) : null;

  return (
    <>
      <span className="MentionsDropdown-symbol">{parent ? childSymbol(tag, parent) : categorySymbol(tag)}</span>
      <span className="username">{parent ? `${parent.name()} > ${tag.name()}` : tag.name()}</span>
    </>
  );
}

/** O trecho antes do cursor começa no `@`/`#` que abriu o menu: a posição dele no texto. */
function triggerStart(editor: any): number | null {
  try {
    const cursor = editor.getSelectionRange()[0];
    const chunk: string = editor.getLastNChars(30);
    const at = Math.max(chunk.lastIndexOf('@'), chunk.lastIndexOf('#'));

    return at < 0 ? null : cursor - chunk.length + at;
  } catch {
    return null;
  }
}

export default function installMentionsDropdown(): void {
  if (!isExtensionEnabled('flarum-mentions')) return;

  // O `@`/`#` sozinho abre a lista.
  for (const format of ['formats/AtMentionFormat', 'formats/HashMentionFormat']) {
    override(MODULE + format, 'queryFromTyped', function (this: any, original: (typed: string) => string | null, typed: any) {
      return typed === '' ? BARE : original(typed);
    });
  }

  for (const mentionable of ['UserMention', 'GroupMention', 'TagMention']) {
    override(MODULE + mentionable, 'matches', function (this: any, original: (model: any, typed: string) => boolean, model: any, typed: any) {
      return typed === BARE ? true : original(model, typed);
    });
  }

  // Com o `@` sozinho, quem participa do tópico vem antes do resto do store.
  override(MODULE + 'UserMention', 'initialResults', function (this: any, original: () => User[]) {
    const all = original();
    const participants = topicParticipants();
    const first = new Set(participants);

    return [...participants, ...all.filter((user) => !first.has(user))];
  });

  override(MODULE + 'TagMention', 'initialResults', function (this: any, original: () => CanelaTag[]) {
    return rankTags(original());
  });

  override(MODULE + 'UserMention', 'suggestion', function (this: any, _original: unknown, model: any) {
    return userSuggestion(model);
  });

  override(MODULE + 'GroupMention', 'suggestion', function (this: any, _original: unknown, model: any) {
    return groupSuggestion(model);
  });

  override(MODULE + 'TagMention', 'suggestion', function (this: any, _original: unknown, model: any) {
    return tagSuggestion(model);
  });

  // Sem "Responder ao #N" na lista: o `@` é só para pessoas e grupos
  // (responder a um post continua no botão "Responder" dele).
  override(MODULE + 'PostMention', 'enabled', function () {
    return false;
  });

  // Os limites: 6 no `@`, 20 no `#`. Cortados antes de montar as linhas (o
  // mentions monta uma para cada casamento, e o `@` sozinho casa com todo
  // mundo do store).
  for (const [mentionable, limit] of [
    ['UserMention', AT_LIMIT],
    ['GroupMention', AT_LIMIT],
    ['TagMention', HASH_LIMIT],
  ] as const) {
    override(MODULE + mentionable, 'maxStoreMatchedResults', () => limit);
  }

  override(MODULE + 'MentionableModels', 'buildSuggestions', function (this: any, original: () => Mithril.Children[]) {
    const suggestions = original();
    const hash = (this.mentionables || []).some((mentionable: any) => mentionable.type() === 'tag');

    return suggestions.slice(0, hash ? HASH_LIMIT : AT_LIMIT);
  });

  // O menu guarda o editor dele, para abrir acima do cursor.
  extend('flarum/common/components/TextEditor', 'onbuild', function (this: any) {
    if (this.mentionsDropdown) this.mentionsDropdown.canelaEditor = this;
  });

  // Acima do cursor quando cabe na tela; senão, onde o mentions pôs
  // (embaixo).
  extend('ext:flarum/mentions/forum/fragments/AutocompleteDropdown', 'show', function (this: any, _result: unknown, left: any, top: any) {
    const editor = this.canelaEditor?.attrs?.composer?.editor;

    if (left === undefined || top === undefined || !editor) return;

    const start = triggerStart(editor);
    const $menu = this.$();

    if (start === null || !$menu?.length) return;

    try {
      // A mesma medida que o mentions acabou de fazer (guardada: composer/caret.ts).
      const caret = editor.getCaretCoordinates(start);
      const height = $menu.outerHeight();
      const parent = $menu.offsetParent();
      const above = caret.top - height - 6;
      const minTop = -(parent.offset().top - window.scrollY);

      if (above >= minTop) $menu.css({ top: `${above}px` });
    } catch {
      // Sem as coordenadas, fica onde o mentions pôs.
    }
  });

  // As setas param nas pontas (sem dar a volta), e o mouse só realça a linha
  // (pelo CSS): a seleção é do teclado.
  override(
    'ext:flarum/mentions/forum/fragments/AutocompleteDropdown',
    'setIndex',
    function (this: any, original: any, index: any, scrollToItem: any) {
      const event = (window as any).event as Event | undefined;

      if (!scrollToItem && event?.type === 'mouseenter') return;

      const count = this.$('li').length;

      return original(Math.max(0, Math.min(count - 1, index)), scrollToItem);
    }
  );
}
