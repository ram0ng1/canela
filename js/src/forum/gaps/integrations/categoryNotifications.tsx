/*
 * O sino de notificações da categoria, na barra de navegação ao lado de "Iniciar Discussão", usando o
 * fof/follow-tags por baixo — a extensão guarda o nível, manda as
 * notificações e esconde os tópicos; o tema só troca a casca.
 *
 * O follow-tags põe o botão dele no IndexSidebar, que o tema esconde nas
 * páginas de lista (a navegação foi para a barra global); daí o sino aqui.
 * Os níveis dele viram estes: lurk = Acompanhando, follow =
 * Acompanhando a primeira postagem, nada = Normal, ignore = Silenciado e
 * hide = Silenciado e fora da lista de Recentes.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Dropdown from 'flarum/common/components/Dropdown';
import DetailedDropdownItem from 'flarum/common/components/DetailedDropdownItem';
import Icon from 'flarum/common/components/Icon';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import ListNavigation from '../../list/ListNavigation';
import { currentTag } from '../../utils/tags';
import { isExtensionEnabled, t } from '../../utils/settings';
import { bellIcon } from '../../utils/bells';

interface Level {
  value: string | null;
  key: string;
  icon: string;
}

const LEVELS: Level[] = [
  {
    value: 'lurk',
    key: 'watching',
    get icon() {
      return bellIcon('watching');
    },
  },
  { value: 'follow', key: 'watching_first_post', icon: 'far fa-circle-dot' },
  { value: null, key: 'normal', icon: 'far fa-bell' },
  { value: 'ignore', key: 'muted', icon: 'fas fa-bell-slash' },
  { value: 'hide', key: 'hidden', icon: 'far fa-eye-slash' },
];

let saving = false;

function currentLevel(tag: any): Level {
  const value = tag.attribute('subscription') ?? null;

  return LEVELS.find((level) => level.value === value) || LEVELS[2];
}

function choose(tag: any, level: Level): void {
  // O nível de antes: depois de salvar, o tag já tem o novo.
  const previous = currentLevel(tag).value;

  if (saving || previous === level.value) return;

  saving = true;

  tag
    .save({ subscription: level.value })
    .then(() => {
      // Entrar ou sair de "Silenciado e oculto" muda o que a lista de Recentes mostra.
      if (level.value === 'hide' || previous === 'hide') app.discussions.refresh();
    })
    .catch(() => {})
    .finally(() => {
      saving = false;
      m.redraw();
    });
}

function bell(tag: any): Mithril.Children {
  const current = currentLevel(tag);
  const label = t(`gaps.category_notifications.${current.key}`);

  return (
    <Dropdown
      className={classList('CanelaNotifications CanelaNotifications--compact CanelaCategoryNotifications', `CanelaNotifications--${current.key}`)}
      buttonClassName="Button Button--icon CanelaNotifications-button"
      menuClassName="CanelaNotifications-menu Dropdown-menu--right"
      icon={current.icon}
      noStyleOverride
      label=""
      caretIcon=""
      accessibleToggleLabel={t('gaps.category_notifications.toggle', { level: label })}
      tooltip={label}
    >
      {LEVELS.map((level) => (
        <DetailedDropdownItem
          icon={<Icon name={level.icon} className="Button-icon" noStyleOverride />}
          label={t(`gaps.category_notifications.${level.key}`)}
          description={t(`gaps.category_notifications.${level.key}_description`)}
          active={level.value === current.value}
          onclick={() => choose(tag, level)}
        />
      ))}
    </Dropdown>
  );
}

export default function installCategoryNotifications(): void {
  extend(ListNavigation.prototype, 'endItems', function (items: ItemList<Mithril.Children>) {
    if (!isExtensionEnabled('fof-follow-tags') || !app.session.user) return;

    const tag = currentTag();

    if (!tag) return;

    // Logo à esquerda do "Iniciar Discussão" (50).
    items.add('canelaCategoryNotifications', bell(tag), 55);
  });

  // O botão do follow-tags no IndexSidebar (o "olho", que no celular sobe
  // para o cabeçalho) repetiria o sino: sai. No beforeMount, para rodar
  // depois do extend do próprio follow-tags, que é registrado depois do tema.
  app.beforeMount(() => {
    extend(IndexSidebar.prototype, 'items', function (items: ItemList<Mithril.Children>) {
      if (isExtensionEnabled('fof-follow-tags') && items.has('subscriptionButton')) items.remove('subscriptionButton');
    });
  });
}
