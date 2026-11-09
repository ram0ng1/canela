/*
 * Card do "Me too" no grupo "Tópico": o liga/desliga, em quais categorias e
 * etiquetas o botão aparece (o padrão
 * é todas), se some com a melhor resposta e se quem marca passa a
 * seguir o tópico. As chaves são `canela.metoo_*`, de extend/metoo.php.
 */
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

import { AdminNotice } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminTagPicker from '../components/AdminTagPicker';
import { trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.metoo';
const TAGS_SETTING = 'canela.metoo_tags';

const toggle = (name: string, extension?: string) => (
  <AdminToggle settingKey={`canela.metoo_${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} extension={extension} />
);

const cards: CardDef[] = [
  {
    id: 'metoo',
    group: 'topic',
    icon: 'far fa-hand',
    title: () => trans(`${KEY}.title`),
    description: () => trans(`${KEY}.enabled_help`),
    keywords: 'me too eu também mão hand problema compartilhado shared issue suporte support bug votar voto',
    master: 'canela.metoo_enabled',
    body: () => (
      <>
        {isExtensionEnabled('flarum-tags') && <AdminTagPicker settingKey={TAGS_SETTING} transKey={KEY} />}
        {toggle('hide_solved', 'fof-best-answer')}
        {toggle('follow', 'flarum-subscriptions')}
        {!isExtensionEnabled('fof-best-answer') && <AdminNotice>{trans(`${KEY}.no_best_answer_notice`)}</AdminNotice>}
      </>
    ),
  },
];

export default cards;
