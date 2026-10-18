/*
 * A seção "Perfil" nas Configurações, logo depois de "Conta" — a ordem das
 * preferências do Discourse (Conta, Perfil, Notificações…).
 *
 * O SettingsPage é carregado sob demanda (rota com import()), por isso o
 * extend usa o nome do módulo e não a classe importada.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import FieldSet from 'flarum/common/components/FieldSet';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { thirdParty } from '../../thirdparty/settings';
import { canEditProfile, profileEnabled, profileField, type ProfileField } from './data';
import { beforeChunk, once } from '../../utils/chunkGate';
import { lazyComponent } from '../../utils/lazy';

// O formulário do perfil é um chunk: desce junto com o da página de
// Configurações do core, então já está pronto no primeiro desenho dela.
const loadSection = once(() => import('./ProfileSettingsSection').then((mod) => mod.default));
let Section: any = null;
const LazySection = lazyComponent(loadSection);

const FIELDS: ProfileField[] = ['bio', 'location', 'website', 'title', 'status', 'cover', 'birthday'];

export default function installSettingsPage() {
  beforeChunk(
    (namespace, url) => namespace === 'core' && /\/forum\/components\/SettingsPage\.js/.test(url),
    () => loadSection().then((component) => (Section = component))
  );

  extend('flarum/forum/components/SettingsPage' as any, 'settingsItems', function (this: any, items: ItemList<Mithril.Children>) {
    const user: User | undefined = this.user;

    if (!user || user !== app.session.user || !profileEnabled() || !canEditProfile(user)) return;
    // A capa da forumaker (thirdparty/profileCover) também pede a seção, mesmo com a capa interna desligada.
    if (!FIELDS.some((field) => profileField(field)) && !thirdParty.profileCover()) return;

    items.add(
      'canelaProfile',
      <FieldSet className="Settings-canelaProfile FieldSet--col" label={t('profile.settings.heading')}>
        {/* A key prende o formulário ao usuário: outro usuário, outro rascunho. */}
        {Section ? <Section key={user.id()} user={user} /> : <LazySection key={user.id()} user={user} />}
      </FieldSet>,
      95
    );
  });
}
