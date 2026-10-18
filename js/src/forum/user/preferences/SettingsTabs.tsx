/*
 * O conteúdo de uma aba das preferências (chunk: desce junto com o
 * SettingsPage do core). As seções são as do `settingsItems` — do core, do
 * tema e das extensões —, filtradas pela aba aberta (ver tabs.ts).
 *
 * Duas seções são redesenhadas, sem mudar como gravam:
 * - "Conta" vira os campos do Discourse: nome de usuário, foto (o
 *   AvatarEditor do core) e e-mail com o estado; os botões são os do
 *   `accountItems` do core. "Alterar senha" passa para a aba Segurança.
 * - As opções de seguir tópicos do flarum/subscriptions saem de
 *   "Notificações" para "Acompanhamento", onde o Discourse as põe.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import AvatarEditor from 'flarum/forum/components/AvatarEditor';
import Button from 'flarum/common/components/Button';
import FieldSet from 'flarum/common/components/FieldSet';
import ItemList from 'flarum/common/utils/ItemList';
import listItems from 'flarum/common/helpers/listItems';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { isTagsEnabled } from '../../utils/tags';
import { getSidebarPicks, type SidebarSectionName } from '../../utils/sidebarPrefs';
import { currentTab, rememberOther, sectionTab, TRACKING_ITEMS, visibleTabs, type PrefTab } from './tabs';

/** Os botões do core que a aba Conta já desenha no lugar certo. */
const ACCOUNT_OWN_ITEMS = ['changeEmail', 'changePassword'];

interface AccountAttrs extends ComponentAttrs {
  user: User;
  /** O `accountItems()` do SettingsPage, com os botões do core e das extensões. */
  items: ItemList<Mithril.Children>;
}

/** Os campos da aba Conta, no formato `control-group` do Discourse. */
class AccountSection extends Component<AccountAttrs> {
  editor: any = null;
  resending = false;
  resent = false;

  view() {
    const { user, items } = this.attrs;
    const extra = new ItemList<Mithril.Children>();

    Object.entries(items.toObject()).forEach(([key, item]) => {
      if (!ACCOUNT_OWN_ITEMS.includes(key)) extra.add(key, item.content as Mithril.Children, item.priority);
    });

    return (
      <div className="CanelaPrefs-account">
        <div className="CanelaPrefs-group CanelaPrefs-username">
          <span className="CanelaPrefs-label">{t('user.preferences.username')}</span>
          <div className="CanelaPrefs-controls">
            <span className="CanelaPrefs-static">{user.username()}</span>
          </div>
          <p className="CanelaPrefs-help">{t('user.preferences.username_help', { username: user.username() })}</p>
        </div>

        <div className="CanelaPrefs-group CanelaPrefs-avatar">
          <span className="CanelaPrefs-label">{t('user.preferences.avatar')}</span>
          <div className="CanelaPrefs-controls">
            {/* A vnode guarda a instância: os botões usam o envio do próprio editor. */}
            <AvatarEditor user={user} className="CanelaPrefs-avatarEditor" oncreate={(vnode: any) => (this.editor = vnode.state)} />
            <Button className="Button" icon="fas fa-camera" onclick={() => this.editor?.openPicker()}>
              {t('user.preferences.avatar_change')}
            </Button>
            {user.hasUploadedAvatar() && (
              <Button className="Button Button--link CanelaPrefs-remove" onclick={() => this.editor?.remove()}>
                {app.translator.trans('core.forum.user.avatar_remove_button')}
              </Button>
            )}
          </div>
          <p className="CanelaPrefs-help">{t('user.preferences.avatar_help')}</p>
        </div>

        <div className="CanelaPrefs-group CanelaPrefs-email">
          <span className="CanelaPrefs-label">{t('user.preferences.email')}</span>
          <div className="CanelaPrefs-emailRow">
            <span className="CanelaPrefs-emailAddress">{user.email()}</span>
            <span className="CanelaPrefs-pill CanelaPrefs-pill--primary">{t('user.preferences.email_primary')}</span>
            {user.isEmailConfirmed() ? (
              <span className="CanelaPrefs-pill CanelaPrefs-pill--ok">{t('user.preferences.email_confirmed')}</span>
            ) : (
              [
                <span className="CanelaPrefs-pill CanelaPrefs-pill--warn">{t('user.preferences.email_unconfirmed')}</span>,
                <Button
                  className="Button Button--link CanelaPrefs-resend"
                  loading={this.resending}
                  disabled={this.resent}
                  onclick={() => this.resend()}
                >
                  {t(this.resent ? 'user.preferences.email_resent' : 'user.preferences.email_resend')}
                </Button>,
              ]
            )}
          </div>
          <div className="CanelaPrefs-controls">{items.has('changeEmail') && items.get('changeEmail')}</div>
          <p className="CanelaPrefs-help">{t('user.preferences.email_help')}</p>
        </div>

        {!extra.isEmpty() && <div className="CanelaPrefs-group CanelaPrefs-extra">{listItems(extra.toArray())}</div>}
      </div>
    );
  }

  /** O mesmo pedido do aviso "confirme seu e-mail" do core. */
  resend() {
    this.resending = true;

    app
      .request({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/users/${this.attrs.user.id()}/send-confirmation` })
      .then(() => (this.resent = true))
      .finally(() => {
        this.resending = false;
        m.redraw();
      });
  }
}

/** "Menu de navegação": o que a barra lateral mostra, como no Discourse. */
function navMenuSection(): Mithril.Children {
  const row = (section: SidebarSectionName) => {
    const picks = getSidebarPicks(section);

    return (
      <div className="CanelaPrefs-group">
        <span className="CanelaPrefs-label">{t(section === 'categories' ? 'sidebar.categories' : 'sidebar.tags')}</span>
        <div className="CanelaPrefs-controls">
          <span className="CanelaPrefs-static">
            {picks ? t('user.preferences.nav_menu_picked', { count: picks.length }) : t('user.preferences.nav_menu_default')}
          </span>
          <Button
            className="Button"
            icon="fas fa-pencil"
            onclick={() => app.modal.show(() => import('../../components/SidebarCustomizeModal'), { section })}
          >
            {t('user.preferences.nav_menu_edit')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <FieldSet className="Settings-canelaNavMenu FieldSet--col" label={t('user.preferences.nav_menu_heading')}>
      <p className="CanelaPrefs-help">{t('user.preferences.nav_menu_help')}</p>
      {row('categories')}
      {row('tags')}
    </FieldSet>
  );
}

/** Todas as seções, já com Conta, Notificações e Acompanhamento refeitas. */
function sections(page: any): ItemList<Mithril.Children> {
  const items: ItemList<Mithril.Children> = page.settingsItems();
  const user: User = page.user;

  if (items.has('account')) {
    items.setContent(
      'account',
      <FieldSet className="Settings-account FieldSet--col" label={app.translator.trans('core.forum.settings.account_heading')}>
        <AccountSection user={user} items={page.accountItems()} />
      </FieldSet>
    );
  }

  if (items.has('notifications')) {
    const notifications: ItemList<Mithril.Children> = page.notificationsItems();
    const tracking = new ItemList<Mithril.Children>();

    TRACKING_ITEMS.forEach((key) => {
      if (!notifications.has(key)) return;
      tracking.add(key, notifications.get(key), notifications.getPriority(key));
      notifications.remove(key);
    });

    items.setContent(
      'notifications',
      <FieldSet className="Settings-notifications FieldSet--min" label={app.translator.trans('core.forum.settings.notifications_heading')}>
        {notifications.toArray()}
      </FieldSet>
    );

    if (!tracking.isEmpty()) {
      items.add(
        'canelaAutoTrack',
        <FieldSet className="Settings-canelaAutoTrack FieldSet--col" label={t('user.preferences.auto_track_heading')}>
          {tracking.toArray()}
        </FieldSet>,
        50
      );
    }
  }

  if (isTagsEnabled()) items.add('canelaNavMenu', navMenuSection(), 10);

  return items;
}

export default function renderTab(page: any): Mithril.Children {
  const user: User = page.user;
  const all = sections(page);
  const keys = Object.keys(all.toObject());
  const hasOther = keys.some((key) => sectionTab(key) === 'other');

  // A aba "Outros" só existe com seções sem lugar; a navegação já foi
  // desenhada, então avisa se mudou.
  if (visibleTabs(user).includes('other') !== hasOther) {
    rememberOther(hasOther);
    setTimeout(m.redraw);
  }

  let tab = currentTab() as PrefTab;
  if (!visibleTabs(user).includes(tab) && !(tab === 'other' && hasOther)) tab = 'account';

  const shown = new ItemList<Mithril.Children>();
  Object.entries(all.toObject()).forEach(([key, item]) => {
    if (sectionTab(key) === tab) shown.add(key, item.content as Mithril.Children, item.priority);
  });

  return (
    <div className={`SettingsPage CanelaPrefs CanelaPrefs--${tab}`}>
      {shown.isEmpty() ? <p className="CanelaPrefs-empty">{t('user.preferences.empty')}</p> : <ul>{listItems(shown.toArray())}</ul>}
    </div>
  );
}
