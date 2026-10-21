/*
 * Gambits próprios do tema:
 *
 * - `em:título` (`in:title`): o texto só vale no título do tópico.
 * - `em:curtidos` (`in:likes`): tópicos com uma postagem que eu curti.
 * - `em:marcadores` (`in:bookmarks`): tópicos com uma postagem que eu marquei.
 * - `mín-postagens:5` (`min-posts:5`): tópicos com pelo menos 5 postagens.
 *
 * Entram no GambitManager do core, então valem em qualquer busca de tópicos —
 * inclusive no modal, que passa a sugeri-los ao digitar — e a página de busca
 * os usa para guardar os filtros avançados na própria consulta
 * ("canela in:title min_posts:5").
 */
import app from 'flarum/forum/app';
import { BooleanGambit, KeyValueGambit } from 'flarum/common/query/IGambit';

import { forumBool, isExtensionEnabled, t } from '../../utils/settings';

/** Os booleanos do tema moram no grupo `em:`/`in:`, e não no `é:` do core. */
abstract class InGambit extends BooleanGambit {
  groupKey(): string {
    return t('extras.gambits.in_group');
  }

  // Lido a cada busca (não no registro): as configurações do fórum ainda não
  // existem quando os initializers rodam.
  enabled(): boolean {
    return gambitsEnabled();
  }
}

/** Os gambits fazem parte da busca avançada: desligada, somem com ela. */
function gambitsEnabled(): boolean {
  return forumBool('canelaSearchPageEnabled', true);
}

export class InTitleGambit extends InGambit {
  key(): string {
    return t('extras.gambits.title_key');
  }

  filterKey(): string {
    return 'canelaInTitle';
  }
}

export class LikedGambit extends InGambit {
  key(): string {
    return t('extras.gambits.likes_key');
  }

  filterKey(): string {
    return 'canelaLiked';
  }

  // O filtro do servidor só existe com o flarum/likes, e só faz sentido logado.
  enabled(): boolean {
    return gambitsEnabled() && !!app.session.user && isExtensionEnabled('flarum-likes');
  }
}

export class BookmarkedGambit extends InGambit {
  key(): string {
    return t('extras.gambits.bookmarks_key');
  }

  filterKey(): string {
    return 'canelaBookmarked';
  }

  // Os marcadores são outro recurso do tema, que pode estar desligado.
  enabled(): boolean {
    return gambitsEnabled() && !!app.session.user && forumBool('canelaBookmarksEnabled', false);
  }
}

export class MinPostsGambit extends KeyValueGambit {
  key(): string {
    return t('extras.gambits.min_posts_key');
  }

  hint(): string {
    return t('extras.gambits.min_posts_hint');
  }

  valuePattern(): string {
    return '(\\d+)';
  }

  filterKey(): string {
    return 'canelaMinPosts';
  }

  enabled(): boolean {
    return gambitsEnabled();
  }
}

export default function installGambits(): void {
  // O mesmo que o extender Search do core faz, mas sem depender do principal
  // registrar um extender a mais: a lista é lida a cada busca.
  const registry = app.search.gambits.gambits;

  registry.discussions ||= [];
  registry.discussions.push(InTitleGambit, LikedGambit, BookmarkedGambit, MinPostsGambit);
}
