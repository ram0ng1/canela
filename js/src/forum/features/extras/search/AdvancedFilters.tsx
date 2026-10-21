/*
 * "Filtros avançados" da página de busca: postado por, na
 * categoria, com etiquetas, onde (só no título, meus, curtidos, não lidos),
 * status, datas e mínimo de postagens.
 *
 * Cada controle altera a consulta (SearchQuery) e devolve a nova pelo
 * `onchange`; quem monta a página reescreve o campo de busca com os gambits
 * correspondentes, num vai-e-vem. A busca só roda ao
 * clicar em "Pesquisar".
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { forumBool, isExtensionEnabled, t } from '../../../utils/settings';
import { isTagsEnabled, primaryTags, secondaryTags, sortTags, type CanelaTag } from '../../../utils/tags';
import type { SearchQuery, SearchStatus } from './query';

export interface AdvancedFiltersAttrs extends ComponentAttrs {
  query: SearchQuery;
  onchange: (query: SearchQuery) => void;
  /** Na aba de postagens só parte dos filtros vale; o resto fica apagado. */
  postsOnly: boolean;
}

const AUTHOR_LOOKUP_DELAY_MS = 250;

export default class AdvancedFilters extends Component<AdvancedFiltersAttrs> {
  /** Sugestões do campo de autor (datalist nativo: teclado e leitor de tela de graça). */
  authorSuggestions: User[] = [];
  authorTimer: ReturnType<typeof setTimeout> | undefined;
  listId = `CanelaSearch-authors-${Math.random().toString(36).slice(2, 8)}`;

  view(): Mithril.Children {
    const { query, postsOnly } = this.attrs;
    const me = app.session.user;

    return (
      <div className="CanelaSearchFilters">
        <div className="CanelaSearchFilters-grid">
          {this.field(
            t('extras.search.filter_author'),
            <div className="CanelaSearchFilters-author">
              <input
                className="FormControl"
                type="text"
                list={this.listId}
                autocomplete="off"
                placeholder={t('extras.search.filter_author_placeholder')}
                value={query.author}
                oninput={(event: InputEvent) => this.authorInput((event.target as HTMLInputElement).value)}
              />
              <datalist id={this.listId}>
                {this.authorSuggestions.map((user) => (
                  <option value={user.username()}>{user.displayName()}</option>
                ))}
              </datalist>
            </div>
          )}

          {isTagsEnabled() &&
            primaryTags().length > 0 &&
            this.field(
              t('extras.search.filter_category'),
              <select
                className="FormControl"
                value={query.category}
                onchange={(event: Event) => this.set({ category: (event.target as HTMLSelectElement).value })}
              >
                <option value="">{t('extras.search.filter_category_any')}</option>
                {this.categoryOptions()}
              </select>
            )}

          {isTagsEnabled() && secondaryTags().length > 0 && this.field(t('extras.search.filter_tags'), this.tagsControl())}

          {this.field(
            t('extras.search.filter_where'),
            <div className="CanelaSearchFilters-checks">
              {this.check(t('extras.search.filter_in_title'), query.inTitle, (value) => this.set({ inTitle: value }), postsOnly)}
              {me &&
                this.check(t('extras.search.filter_mine'), query.author === me.username(), (value) =>
                  this.set({ author: value ? me.username() : '' })
                )}
              {me &&
                isExtensionEnabled('flarum-likes') &&
                this.check(t('extras.search.filter_liked'), query.liked, (value) => this.set({ liked: value }))}
              {me &&
                forumBool('canelaBookmarksEnabled', false) &&
                this.check(t('extras.search.filter_bookmarked'), query.bookmarked, (value) => this.set({ bookmarked: value }))}
              {me && this.check(t('extras.search.filter_unread'), query.unread, (value) => this.set({ unread: value }), postsOnly)}
            </div>
          )}

          {this.statusOptions().length > 1 &&
            this.field(
              t('extras.search.filter_status'),
              <select
                className="FormControl"
                value={query.status}
                disabled={postsOnly}
                onchange={(event: Event) => this.set({ status: (event.target as HTMLSelectElement).value as SearchStatus })}
              >
                {this.statusOptions().map(([value, label]) => (
                  <option value={value}>{label}</option>
                ))}
              </select>
            )}

          {this.field(
            t('extras.search.filter_posted'),
            <div className="CanelaSearchFilters-dates">
              <label>
                <span>{t('extras.search.filter_after')}</span>
                <input
                  className="FormControl"
                  type="date"
                  value={query.after}
                  disabled={postsOnly}
                  onchange={(event: Event) => this.set({ after: (event.target as HTMLInputElement).value })}
                />
              </label>
              <label>
                <span>{t('extras.search.filter_before')}</span>
                <input
                  className="FormControl"
                  type="date"
                  value={query.before}
                  disabled={postsOnly}
                  onchange={(event: Event) => this.set({ before: (event.target as HTMLInputElement).value })}
                />
              </label>
            </div>
          )}

          {this.field(
            t('extras.search.filter_min_posts'),
            <input
              className="FormControl CanelaSearchFilters-number"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              value={query.minPosts}
              disabled={postsOnly}
              oninput={(event: InputEvent) => this.set({ minPosts: (event.target as HTMLInputElement).value })}
            />
          )}
        </div>

        {postsOnly && (
          <p className="CanelaSearchFilters-note">
            <Icon name="fas fa-circle-info" />
            {t('extras.search.posts_filters_note')}
          </p>
        )}
      </div>
    );
  }

  field(label: string, control: Mithril.Children): Mithril.Children {
    return (
      <div className="CanelaSearchFilters-field">
        <div className="CanelaSearchFilters-label">{label}</div>
        {control}
      </div>
    );
  }

  check(label: string, checked: boolean, onchange: (value: boolean) => void, disabled = false): Mithril.Children {
    return (
      <label className={`CanelaSearchFilters-check${disabled ? ' is-disabled' : ''}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onchange={(event: Event) => onchange((event.target as HTMLInputElement).checked)}
        />
        <span>{label}</span>
      </label>
    );
  }

  set(patch: Partial<SearchQuery>): void {
    this.attrs.onchange({ ...this.attrs.query, ...patch });
  }

  categoryOptions(): Mithril.Children {
    const options: Mithril.Children[] = [];

    for (const tag of primaryTags()) {
      options.push(<option value={tag.slug()}>{tag.name()}</option>);

      const children = sortTags(((tag.children() || []) as CanelaTag[]).filter(Boolean));

      for (const child of children) {
        // Recuo com espaços fixos: <option> não aceita estilo de margem.
        options.push(<option value={child.slug()}>{`   ${child.name()}`}</option>);
      }
    }

    return options;
  }

  tagsControl(): Mithril.Children {
    const { query } = this.attrs;
    const chosen = query.tags;
    const available = secondaryTags().filter((tag) => !chosen.includes(tag.slug()));
    const nameOf = (slug: string) =>
      secondaryTags()
        .find((tag) => tag.slug() === slug)
        ?.name() || slug;

    return (
      <div className="CanelaSearchFilters-tags">
        {chosen.map((slug) => (
          <span className="CanelaSearchFilters-chip">
            {nameOf(slug)}
            <Button
              className="Button Button--icon Button--link CanelaSearchFilters-chipRemove"
              icon="fas fa-times"
              aria-label={t('extras.search.filter_tag_remove', { name: nameOf(slug) })}
              onclick={() => this.set({ tags: chosen.filter((item) => item !== slug) })}
            />
          </span>
        ))}
        {available.length > 0 && (
          <select
            className="FormControl CanelaSearchFilters-tagAdd"
            value=""
            aria-label={t('extras.search.filter_tags')}
            onchange={(event: Event) => {
              const value = (event.target as HTMLSelectElement).value;
              if (value) this.set({ tags: [...chosen, value] });
            }}
          >
            <option value="">{t('extras.search.filter_tags_add')}</option>
            {available.map((tag) => (
              <option value={tag.slug()}>{tag.name()}</option>
            ))}
          </select>
        )}
      </div>
    );
  }

  statusOptions(): [SearchStatus, string][] {
    const options: [SearchStatus, string][] = [['', t('extras.search.status_any')]];

    if (isExtensionEnabled('flarum-lock')) {
      options.push(['open', t('extras.search.status_open')], ['closed', t('extras.search.status_closed')]);
    }

    if (isExtensionEnabled('flarum-sticky')) options.push(['sticky', t('extras.search.status_sticky')]);

    return options;
  }

  authorInput(value: string): void {
    this.set({ author: value });

    clearTimeout(this.authorTimer);

    const term = value.trim();

    // A busca de usuários depende de permissão; sem ela o campo segue aceitando
    // o nome digitado, só sem sugestões.
    if (term.length < 2 || !app.forum.attribute('canSearchUsers')) return;

    this.authorTimer = setTimeout(() => {
      app.store
        .find<User[]>('users', { filter: { q: term }, page: { limit: 6 } })
        .then((users) => {
          this.authorSuggestions = users;
          m.redraw();
        })
        .catch(() => {});
    }, AUTHOR_LOOKUP_DELAY_MS);
  }

  onremove(vnode: Mithril.VnodeDOM<AdvancedFiltersAttrs, this>): void {
    super.onremove(vnode);
    clearTimeout(this.authorTimer);
  }
}
