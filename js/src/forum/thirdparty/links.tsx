/*
 * fof/links na barra lateral, como as seções personalizadas do Discourse.
 *
 * O Horizon não tem links no cabeçalho: tudo o que o admin acrescenta mora
 * na barra. Então:
 * - os links soltos (e os filhos deles) entram na seção de links que o tema
 *   já tem (`canelaCustom`, a dos "Rótulo | endereço | ícone" do admin) — uma
 *   seção só, e não duas com o mesmo papel;
 * - cada rótulo da extensão com filhos vira uma seção própria, com o rótulo
 *   como título;
 * - o cabeçalho perde os itens da extensão.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import LinkButton from 'flarum/common/components/LinkButton';
import HeaderPrimary from 'flarum/forum/components/HeaderPrimary';
import listItems from 'flarum/common/helpers/listItems';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import CanelaSidebar from '../components/CanelaSidebar';
import SidebarSection from '../components/SidebarSection';
import { customLinks } from '../gaps/sidebar';
import { forumString } from '../gaps/settings';
import { t } from '../utils/settings';
import { extModule, thirdParty } from './settings';

type LinkModel = any;

function allLinks(): LinkModel[] {
  return app.store.all<LinkModel>('links');
}

function sorted(links: LinkModel[]): LinkModel[] {
  return links.slice(0).sort((a, b) => (a.position() ?? 0) - (b.position() ?? 0));
}

function childrenOf(parent: LinkModel): LinkModel[] {
  return sorted(allLinks().filter((link) => link.parent?.() === parent));
}

function isLabel(link: LinkModel): boolean {
  return !link.url();
}

/** O item da própria extensão (ativo, nova aba, rel=me); sem ele, um LinkButton simples. */
function entry(link: LinkModel, child = false): Mithril.Children {
  const LinkItem = extModule<any>('fof-links', 'forum/components/LinkItem');
  const className = child ? 'CanelaSidebar-childLink' : undefined;

  if (LinkItem) return m(LinkItem, { link, inDropdown: true, className });

  return (
    <LinkButton
      className={className}
      href={link.url()}
      icon={link.icon() || 'fas fa-link'}
      external={true}
      target={link.isNewtab() ? '_blank' : undefined}
    >
      {link.title()}
    </LinkButton>
  );
}

/** Os links do admin do tema (a configuração em texto), no mesmo formato da seção do gaps. */
function themeLink(href: string, icon: string, label: string): Mithril.Children {
  let foreign = false;

  try {
    foreign = /^https?:\/\//i.test(href) && new URL(href).host !== window.location.host;
  } catch {
    foreign = true;
  }

  return (
    <LinkButton href={href} icon={icon} external={true} target={foreign ? '_blank' : undefined} rel={foreign ? 'noopener noreferrer' : undefined}>
      {label}
    </LinkButton>
  );
}

export default function installLinks(): void {
  extend(HeaderPrimary.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.linksSidebar()) return;

    Object.keys(items.toObject())
      .filter((key) => /^link\d+$/.test(key))
      .forEach((key) => items.remove(key));
  });

  extend(CanelaSidebar.prototype, 'sectionItems', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.linksSidebar()) return;

    const roots = sorted(allLinks().filter((link) => !link.isChild?.()));

    if (!roots.length) return;

    const loose = new ItemList<Mithril.Children>();
    let priority = 100;

    // Primeiro os do admin do tema, na ordem dele; depois os da extensão.
    customLinks().forEach((link, index) => loose.add(`custom${index}`, themeLink(link.href, link.icon, link.label), priority--));

    roots.forEach((root, index) => {
      const children = childrenOf(root);

      if (isLabel(root)) {
        if (!children.length) return;

        const list = new ItemList<Mithril.Children>();
        children.forEach((child, i) => list.add(`fofLink${child.id()}`, entry(child), 100 - i));

        // Logo depois da seção de links do tema (85), na ordem do admin.
        items.add(
          `fofLinks${root.id()}`,
          <SidebarSection name={`fofLinks${root.id()}`} title={root.title()}>
            {listItems(list.toArray())}
          </SidebarSection>,
          84.9 - index / 100
        );

        return;
      }

      loose.add(`fofLink${root.id()}`, entry(root), priority--);
      children.forEach((child) => loose.add(`fofLink${child.id()}`, entry(child, true), priority--));
    });

    if (loose.isEmpty()) return;

    // A seção do gaps é refeita com os links dos dois lados.
    if (items.has('canelaCustom')) items.remove('canelaCustom');

    items.add(
      'canelaCustom',
      <SidebarSection name="custom" title={forumString('canelaSidebarCustomTitle') || t('gaps.sidebar.custom_title')}>
        {listItems(loose.toArray())}
      </SidebarSection>,
      85
    );
  });
}
