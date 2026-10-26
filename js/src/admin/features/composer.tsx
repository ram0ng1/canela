/*
 * Cards do editor (composer): a chave geral no cabeçalho do card
 * principal e cada recurso. As chaves são `canela.composer_*`, registradas em
 * extend/composer.php — todas ligadas por padrão. Rascunhos e hashtags
 * dependem da chave geral: com ela desligada, os cards deles somem.
 */
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

import { AdminNotice } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import { trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.composer';

const toggle = (name: string) => (
  <AdminToggle settingKey={`canela.composer_${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} />
);

const cards: CardDef[] = [
  {
    id: 'composer',
    group: 'composer',
    icon: 'fas fa-pen-to-square',
    title: () => trans(`${KEY}.section_editor`),
    description: () => trans(`${KEY}.enabled_help`),
    keywords: 'editor composer emoji seletor picker prévia preview lado a lado split semelhante similar vinculado linked responder tópico',
    master: 'canela.composer_enabled',
    body: () => (
      <>
        {toggle('emoji')}
        {!isExtensionEnabled('flarum-emoji') && <AdminNotice>{trans(`${KEY}.emoji_notice`)}</AdminNotice>}
        {toggle('preview')}
        {toggle('similar')}
        {toggle('linked_topic')}
      </>
    ),
  },
  {
    id: 'drafts',
    group: 'composer',
    icon: 'fas fa-pen-ruler',
    title: () => trans(`${KEY}.section_drafts`),
    description: () => trans(`${KEY}.drafts_help`),
    keywords: 'rascunho rascunhos drafts salvar save automático autosave fof',
    master: 'canela.composer_drafts',
    dependsOn: 'canela.composer_enabled',
    // Os rascunhos são do fof/drafts: sem ele, o tema não tem onde guardá-los.
    extensions: ['fof-drafts'],
    body: () => <p className="helpText">{trans(`${KEY}.drafts_note`)}</p>,
  },
  {
    id: 'hashtags',
    group: 'composer',
    icon: 'fas fa-hashtag',
    title: () => trans(`${KEY}.section_hashtags`),
    description: () => trans(`${KEY}.hashtags_help`),
    keywords: 'hashtag # categoria etiqueta tag link autocompletar autocomplete pílula',
    master: 'canela.composer_hashtags',
    dependsOn: 'canela.composer_enabled',
    extensions: ['flarum-tags'],
    body: () => (isExtensionEnabled('flarum-mentions') ? <AdminNotice>{trans(`${KEY}.hashtags_mentions_notice`)}</AdminNotice> : null),
  },
];

export default cards;
