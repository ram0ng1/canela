/*
 * Cards do perfil estendido: os campos extras (bio, local, site,
 * título, status, capa, aniversário), cada um ligado e desligado aqui.
 */
import { trans, getBool, extensionOn } from '../util';
import { AdminNotice, AdminSubGroup, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminNumber from '../components/AdminNumber';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.profile';

const toggle = (name: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} />
);

const help = (name: string) => () => trans(`${KEY}.${name}_help`);

const PROFILE_CARDS: CardDef[] = [
  {
    id: 'profile-fields',
    group: 'people',
    icon: 'far fa-id-card',
    title: () => trans(`${KEY}.section_main`),
    description: help('profile_enabled'),
    keywords: 'perfil profile bio sobre about local location site website aniversário birthday campos fields',
    master: 'canela.profile_enabled',
    body: () => (
      <>
        {toggle('profile_bio')}
        {getBool('canela.profile_bio') && (
          <AdminSubGroup>
            <AdminNumber
              settingKey="canela.profile_bio_max_length"
              min={100}
              max={3000}
              fallback={1000}
              suffix={trans(`${KEY}.characters_suffix`)}
              label={trans(`${KEY}.profile_bio_max_length_label`)}
              help={trans(`${KEY}.profile_bio_max_length_help`, { min: 100, max: 3000 })}
            />
          </AdminSubGroup>
        )}
        <SubDivider />
        {toggle('profile_location')}
        {toggle('profile_website')}
        {toggle('profile_birthday')}
      </>
    ),
  },
  {
    id: 'profile-title',
    group: 'people',
    icon: 'fas fa-medal',
    title: () => trans(`${KEY}.section_title`),
    description: help('profile_title'),
    keywords: 'título title cargo distinção abaixo do nome moderação',
    master: 'canela.profile_title',
    dependsOn: 'canela.profile_enabled',
    body: () => toggle('profile_title_self'),
  },
  {
    id: 'profile-status',
    group: 'people',
    icon: 'far fa-face-smile',
    title: () => trans(`${KEY}.section_status`),
    description: help('profile_status'),
    keywords: 'status emoji férias ausente away ocupado busy limpar expira',
    master: 'canela.profile_status',
    dependsOn: 'canela.profile_enabled',
  },
  {
    id: 'profile-cover',
    group: 'people',
    icon: 'far fa-image',
    title: () => trans(`${KEY}.section_cover`),
    description: help('profile_cover'),
    keywords: 'capa cover imagem image fundo background cartão card upload envio url',
    master: 'canela.profile_cover',
    dependsOn: 'canela.profile_enabled',
    body: () => (
      <>
        {toggle('profile_cover_upload')}
        {toggle('profile_external_images')}
        {extensionOn('forumaker-profile-cover') && getBool('canela.thirdparty_profile_cover') && (
          <AdminNotice icon="fas fa-panorama">{trans(`${KEY}.cover_forumaker_notice`)}</AdminNotice>
        )}
        {/* O aviso sobre imagens de outros sites só vale com elas permitidas. */}
        {getBool('canela.profile_external_images') && <AdminNotice>{trans(`${KEY}.cover_notice`)}</AdminNotice>}
      </>
    ),
  },
];

export default PROFILE_CARDS;
