/*
 * A página de categorias no estilo do Discourse: a barra de navegação no
 * topo, as categorias em caixas (ou em tabela, conforme o admin) e, abaixo,
 * as etiquetas com a contagem de tópicos.
 *
 * Com os endereços do Discourse ligados, /categories é essa página e /tags
 * vira a página de etiquetas do Discourse ("Etiquetas", "Ordenar por
 * contagem/nome" e a lista). Sem eles, /tags faz as duas vezes.
 *
 * O TagsPage é do flarum/tags; ele é buscado no registro de módulos só se a
 * extensão estiver ativa, para o tema não depender dela.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { categoryBadge, categorySymbol, isTagsEnabled, separateTagsPage, sortTags, tagSymbol, tagUrl, type CanelaTag } from '../utils/tags';
import { shortAge, fullDate } from '../utils/dates';
import ListNavigation from './ListNavigation';

type Layout = 'boxes' | 'list';

function layout(): Layout {
  return app.forum.attribute<string>('canelaCategoriesLayout') === 'list' ? 'list' : 'boxes';
}

function childrenOf(tag: CanelaTag): CanelaTag[] {
  const children = tag.children();

  return Array.isArray(children) ? sortTags(children.filter(Boolean)) : [];
}

function colorStyle(tag: CanelaTag): Record<string, string> | undefined {
  const color = tag.color();

  return color ? { '--category-color': color } : undefined;
}

function boxesView(categories: CanelaTag[]): Mithril.Children {
  return (
    <ul className="CanelaCategoryBoxes">
      {categories.map((tag) => {
        const children = childrenOf(tag);

        return (
          <li className="CanelaCategoryBox" style={colorStyle(tag)}>
            <h3 className="CanelaCategoryBox-title">
              {/* O link do título se estica sobre a caixa inteira (::after);
                  os links das filhas ficam por cima dele. */}
              <Link className="CanelaCategoryBox-link" href={tagUrl(tag)}>
                {categorySymbol(tag)}
                <span className="CanelaCategoryBox-name">{tag.name()}</span>
              </Link>
            </h3>
            {tag.description() && <p className="CanelaCategoryBox-description">{tag.description()}</p>}
            {children.length > 0 && (
              <ul className="CanelaCategoryBox-children">
                {children.map((child) => (
                  <li>{categoryBadge(child)}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const skeletonLine = (width: string) => <span className="CanelaSkeleton CanelaSkeleton--line" style={{ width }} />;

/** As caixas carregando: nome, descrição de duas linhas e a fileira das filhas. */
function boxesSkeleton(): Mithril.Children {
  return (
    <ul className="CanelaCategoryBoxes CanelaCategoryBoxes--loading" aria-busy="true">
      {['48%', '36%', '56%', '42%', '30%', '52%'].map((width) => (
        <li className="CanelaCategoryBox">
          <h3 className="CanelaCategoryBox-title">{skeletonLine(width)}</h3>
          <p className="CanelaCategoryBox-description">
            {skeletonLine('92%')}
            {skeletonLine('60%')}
          </p>
          <ul className="CanelaCategoryBox-children">
            {['4.5em', '6em', '5em'].map((child) => (
              <li>{skeletonLine(child)}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** A tabela carregando: o cabeçalho de verdade e linhas com barras. */
function listSkeleton(): Mithril.Children {
  return (
    <table className="CanelaCategoryTable CanelaCategoryTable--loading" aria-busy="true">
      <thead>
        <tr>
          <th className="CanelaCategoryTable-category">{t('categories.category')}</th>
          <th className="CanelaCategoryTable-topics">{t('categories.topics')}</th>
          <th className="CanelaCategoryTable-latest">{t('categories.latest')}</th>
        </tr>
      </thead>
      <tbody>
        {['30%', '22%', '36%', '26%', '18%'].map((width) => (
          <tr>
            <td className="CanelaCategoryTable-category">
              <h3 className="CanelaCategoryTable-name">{skeletonLine(width)}</h3>
              <p className="CanelaCategoryTable-description">{skeletonLine('70%')}</p>
            </td>
            <td className="CanelaCategoryTable-topics">
              <span className="CanelaSkeleton CanelaSkeleton--word" style={{ width: '1.5em' }} />
            </td>
            <td className="CanelaCategoryTable-latest">
              <div className="CanelaCategoryTable-latestInner">{skeletonLine('80%')}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function latestView(tag: CanelaTag): Mithril.Children {
  const discussion = tag.lastPostedDiscussion() as Discussion | null | false | undefined;

  if (!discussion) return <span className="CanelaCategoryTable-none">-</span>;

  const date = discussion.lastPostedAt();

  return (
    <div className="CanelaCategoryTable-latestInner">
      <Link className="CanelaCategoryTable-latestTitle" href={app.route.discussion(discussion, discussion.lastPostNumber() ?? undefined)}>
        {discussion.title()}
      </Link>
      {date && (
        <span className="CanelaCategoryTable-latestAge" title={fullDate(date)}>
          {shortAge(date)}
        </span>
      )}
    </div>
  );
}

function listView(categories: CanelaTag[]): Mithril.Children {
  return (
    <table className="CanelaCategoryTable">
      <thead>
        <tr>
          <th className="CanelaCategoryTable-category">{t('categories.category')}</th>
          <th className="CanelaCategoryTable-topics">{t('categories.topics')}</th>
          <th className="CanelaCategoryTable-latest">{t('categories.latest')}</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((tag) => {
          const children = childrenOf(tag);

          return (
            <tr style={colorStyle(tag)}>
              <td className="CanelaCategoryTable-category">
                <h3 className="CanelaCategoryTable-name">
                  <Link href={tagUrl(tag)}>
                    {categorySymbol(tag)}
                    <span>{tag.name()}</span>
                  </Link>
                </h3>
                {tag.description() && <p className="CanelaCategoryTable-description">{tag.description()}</p>}
                {children.length > 0 && <div className="CanelaCategoryTable-children">{children.map((child) => categoryBadge(child))}</div>}
              </td>
              <td className="CanelaCategoryTable-topics">{tag.discussionCount()}</td>
              <td className="CanelaCategoryTable-latest">{latestView(tag)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function tagsView(labels: CanelaTag[], title = t('categories.tags_title')): Mithril.Children {
  return (
    <section className="CanelaTagCloud">
      <h2 className="CanelaTagCloud-title">{title}</h2>
      <ul className="CanelaTagCloud-list">
        {labels.map((tag) => (
          <li className="CanelaTagCloud-item">
            <Link
              className="CanelaTagCloud-tag"
              href={tagUrl(tag)}
              title={tag.description() || undefined}
              style={tag.color() ? { '--tag-color': tag.color() } : undefined}
            >
              {tagSymbol(tag)}
              <span>{tag.name()}</span>
            </Link>
            <span className="CanelaTagCloud-count">x {tag.discussionCount()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A ordenação da página de etiquetas; dura a sessão, como no Discourse. */
let tagSort: 'count' | 'name' = 'count';

function sortLink(key: 'count' | 'name', label: string): Mithril.Children {
  return (
    <a
      href="#"
      className={classList('CanelaTagsPage-sort', { active: tagSort === key })}
      aria-pressed={tagSort === key ? 'true' : 'false'}
      onclick={(event: MouseEvent) => {
        event.preventDefault();
        tagSort = key;
      }}
    >
      {label}
    </a>
  );
}

/** A página /tags do Discourse (`.tags-index`). */
function tagsPageView(labels: CanelaTag[]): Mithril.Children {
  const sorted = tagSort === 'name' ? labels.slice().sort((a, b) => a.name().localeCompare(b.name(), undefined, { sensitivity: 'base' })) : labels;

  return (
    <div className="CanelaTagsPage">
      <h2 className="CanelaTagsPage-title">{t('categories.tags_title')}</h2>
      <div className="CanelaTagsPage-sortOptions">
        {t('categories.tags_sort_by')} {sortLink('count', t('categories.tags_sort_count'))} {sortLink('name', t('categories.tags_sort_name'))}
      </div>
      <hr className="CanelaTagsPage-rule" />
      {sorted.length ? tagsView(sorted, t('categories.tags_all')) : <p className="CanelaTagsPage-empty">{t('categories.tags_none')}</p>}
    </div>
  );
}

function onTagsPage(): boolean {
  return separateTagsPage() && app.current.get('routeName') === 'tags';
}

export default function installCategoriesPage(): void {
  if (!isTagsEnabled()) return;

  const TagsPage = flarum.reg.checkModule('flarum-tags', 'forum/components/TagsPage');

  if (!TagsPage) return;

  // O WelcomeHero repetido em cima das categorias só empurraria a grade para
  // baixo; a aba "Categorias" ativa na barra já diz onde o leitor está.
  override(TagsPage.prototype, 'hero', function () {
    return null;
  });

  extend(TagsPage.prototype, 'contentItems', function (this: any, items: ItemList<Mithril.Children>) {
    const tagsPage = onTagsPage();

    // A página de etiquetas do Discourse não tem a barra de navegação.
    if (!tagsPage) items.add('canelaNav', <ListNavigation />, 200);

    if (this.loading) {
      // No lugar do spinner, as caixas (ou a tabela) das categorias com as
      // classes das reais: elas chegam onde o esqueleto estava.
      if (!tagsPage) {
        items.remove('loading');
        items.add('canelaCategories', layout() === 'list' ? listSkeleton() : boxesSkeleton(), 100);
      }

      return;
    }

    const tags: CanelaTag[] = this.tags || [];
    const categories = sortTags(tags.filter((tag) => tag.position() !== null && !tag.isChild()));
    const labels = tags.filter((tag) => tag.position() === null).sort((a, b) => b.discussionCount() - a.discussionCount());

    items.remove('tagTiles');
    items.remove('cloud');

    if (tagsPage) {
      items.add('canelaTagsPage', tagsPageView(labels), 100);

      return;
    }

    if (categories.length) {
      items.add('canelaCategories', layout() === 'list' ? listView(categories) : boxesView(categories), 100);
    }

    if (labels.length) {
      items.add('canelaTags', tagsView(labels), 10);
    }
  });
}
