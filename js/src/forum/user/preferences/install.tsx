/*
 * Preferências em abas, como no Discourse: `/u/:username/preferences/:tab`
 * com a navegação em pílulas sob o cabeçalho do perfil (ver o `sidebar` em
 * installProfile.tsx) e cada aba com as suas seções.
 *
 * O SettingsPage do core continua sendo a página (e a gravação é a dele:
 * `savePreferences`, `user.save`); o tema só troca o `content()` para mostrar
 * as seções da aba aberta. O `/settings` do core vira a aba "Conta".
 *
 * O SettingsPage e o UserSecurityPage vêm em chunks do core: os extends usam
 * o nome do módulo, e o desenho das abas (chunk do tema) desce junto com o
 * do SettingsPage.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import FieldSet from 'flarum/common/components/FieldSet';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';
import DefaultResolver from 'flarum/common/resolvers/DefaultResolver';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { beforeChunk, once } from '../../utils/chunkGate';
import { BASE_ROUTE, TAB_ROUTE } from './tabs';

type RenderTab = (page: any) => Mithril.Children;

const loadTabs = once(() => import('./SettingsTabs').then((mod) => mod.default as RenderTab));
let renderTab: RenderTab | null = null;

/**
 * A mesma página para todas as abas: trocar de aba não recria a página (nem o
 * cabeçalho do perfil), só o conteúdo, que lê a aba do endereço.
 */
class PreferencesResolver extends UserPageResolver {
  makeKey() {
    return BASE_ROUTE + (this.canonicalizeUserSlug(m.route.param('username')) || '');
  }

  // Sem o acerto do slug do UserPageResolver: ele monta o endereço sem a aba.
  // O SettingsPage já leva quem chega com outro nome às próprias preferências.
  render(vnode: Mithril.Vnode<any, any>) {
    return DefaultResolver.prototype.render.call(this, vnode);
  }
}

/** Visitante (o servidor só protege o endereço com aba) volta ao início. */
const GuestRedirect = {
  oninit() {
    m.route.set(app.route('index'), undefined, { replace: true });
  },
  view: () => null,
};

export default function installPreferences() {
  const settings = app.routes.settings as any;
  // O SettingsPage do core (chunk) só para quem está logado: sem usuário, o
  // `show()` dele e os extends das extensões quebrariam.
  const component = () => (app.session.user ? settings.component() : Promise.resolve({ default: GuestRedirect }));

  app.routes[BASE_ROUTE] = { path: '/u/:username/preferences', component, resolverClass: PreferencesResolver } as any;
  app.routes[TAB_ROUTE] = { path: '/u/:username/preferences/:tab', component, resolverClass: PreferencesResolver } as any;

  beforeChunk(
    (namespace, url) => namespace === 'core' && /\/forum\/components\/SettingsPage\.js/.test(url),
    () => loadTabs().then((render) => (renderTab = render))
  );

  override('flarum/forum/components/SettingsPage' as any, 'oninit', function (this: any, original: (vnode: unknown) => void, vnode: unknown) {
    original(vnode);

    const user = app.session.user!;

    // O `/settings` do core e as preferências de outro nome levam às próprias.
    const route = app.current.get('routeName');
    const username = m.route.param('username');

    if (route === 'settings' || (username && username.split('-')[0] !== user.slug().split('-')[0])) {
      const tab = route === TAB_ROUTE ? m.route.param('tab') : 'account';

      m.route.set(app.route(TAB_ROUTE, { username: user.slug(), tab }), undefined, { replace: true });
    }
  });

  override('flarum/forum/components/SettingsPage' as any, 'content', function (this: any) {
    if (!renderTab) {
      loadTabs().then((render) => {
        renderTab = render;
        m.redraw();
      });

      return <LoadingIndicator />;
    }

    return renderTab(this);
  });

  // "Senha" na aba Segurança, como no Discourse (o botão é o do core).
  extend('flarum/forum/components/UserSecurityPage' as any, 'settingsItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!this.user || this.user !== app.session.user) return;

    items.add(
      'canelaPassword',
      <FieldSet className="UserSecurityPage-canelaPassword FieldSet--col" label={t('user.preferences.password_heading')}>
        <Button
          className="Button"
          icon="fas fa-key"
          onclick={() => app.modal.show(() => flarum.reg.asyncModuleImport('flarum/forum/components/ChangePasswordModal'))}
        >
          {app.translator.trans('core.forum.settings.change_password_button')}
        </Button>
        <p className="helpText">{t('user.preferences.password_help')}</p>
      </FieldSet>,
      200
    );
  });
}
