/*
 * Ajustes nos controles da direita do cabeçalho para ficarem como os do
 * Discourse: o idioma vira a pílula com o código ("PT ⌄"), o "Entrar" ganha o ícone e o
 * seletor de tema sai do cabeçalho quando o rodapé da barra lateral já o
 * oferece.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool } from '../utils/settings';
import LocaleSwitcher from './LocaleSwitcher';

export default function extendHeader() {
  // O fof/drafts põe uma pena (DraftsDropdown, chave `Drafts`) no cabeçalho.
  // O Discourse não tem esse ícone: os rascunhos ficam no "⌄" do botão "Novo
  // tópico". O initializer do fof roda depois do tema, então a remoção é
  // registrada no `mount`, quando todos os itens já foram acrescentados.
  override(app as any, 'mount', function (this: any, original: (...args: any[]) => unknown, ...args: any[]) {
    extend(HeaderSecondary.prototype, 'items', function (items: ItemList<Mithril.Children>) {
      if (items.has('Drafts')) items.remove('Drafts');
    });

    return original(...args);
  });

  extend(HeaderSecondary.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    const sidebarFooter = forumBool('canelaSidebarEnabled', true) && forumBool('canelaSidebarFooter', true);

    if (sidebarFooter && items.has('themeSwitcher')) {
      items.remove('themeSwitcher');
    }

    if (items.has('locale')) {
      // O seletor de idioma: o código do idioma atual numa pílula e, aberto,
      // os nomes dos idiomas num balão com seta.
      items.setContent('locale', LocaleSwitcher());

      // Para o visitante, o Discourse põe o "PT" depois de Cadastrar-se/Entrar;
      // logado, ele vem antes dos ícones.
      if (!app.session.user) items.setPriority('locale', -10);
    }

    // "Entrar" leva o ícone de pessoa, como o .login-button do Discourse.
    if (items.has('logIn')) {
      const logIn = items.get('logIn') as Mithril.Vnode<any>;

      if (logIn && logIn.attrs) logIn.attrs.icon = 'far fa-user';
    }
  });
}
