/*
 * Cards do editor (composer) do Discourse: a chave geral no cabeçalho do card
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

const toggle = (name: string, label: string, help: string) => (
  <AdminToggle settingKey={`canela.composer_${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} />
);

const cards: CardDef[] = [
  {
    id: 'composer',
    group: 'composer',
    icon: 'fas fa-pen-to-square',
    title: () => trans(`${KEY}.section_editor`, 'Editor do Discourse'),
    description: () => trans(`${KEY}.enabled_help`, 'A chave geral: desligada, o composer volta a ser o do Flarum, sem nenhum dos recursos abaixo.'),
    keywords: 'editor composer emoji seletor picker prévia preview lado a lado split semelhante similar vinculado linked responder tópico',
    master: 'canela.composer_enabled',
    body: () => (
      <>
        {toggle(
          'emoji',
          'Seletor de emoji',
          'O botão de emoji da barra abre o seletor com busca, categorias, usados recentemente e tom de pele. Com a extensão Emoji, os emoji aparecem como as imagens dela.'
        )}
        {!isExtensionEnabled('flarum-emoji') && (
          <AdminNotice>
            {trans(
              `${KEY}.emoji_notice`,
              'A extensão Emoji está desligada: o seletor usa os emoji do sistema e o tema oferece o autocompletar ":nome".'
            )}
          </AdminNotice>
        )}
        {toggle(
          'preview',
          'Pré-visualização lado a lado',
          'No computador, com o composer alto o bastante, o texto formatado aparece à direita do editor. Cada pessoa pode escondê-la pelo botão do rodapé.'
        )}
        {toggle(
          'similar',
          'Discussões semelhantes',
          'Ao escrever o título de uma discussão nova (três palavras ou mais), mostra "Sua discussão é semelhante a…" com até cinco discussões parecidas.'
        )}
        {toggle(
          'linked_topic',
          'Responder como discussão vinculada',
          'No composer de resposta, o menu "↩ ▾" troca a resposta por uma discussão nova com o mesmo texto, um link de volta e as mesmas tags.'
        )}
      </>
    ),
  },
  {
    id: 'drafts',
    group: 'composer',
    icon: 'fas fa-pen-ruler',
    title: () => trans(`${KEY}.section_drafts`, 'Rascunhos'),
    description: () =>
      trans(
        `${KEY}.drafts_help`,
        'Com a extensão FoF Drafts, o tema mostra os rascunhos como o Discourse: a discussão nova e a resposta são salvas sozinhas, responder numa discussão retoma o rascunho dela, fechar com texto pergunta se descarta ou guarda, e o botão Iniciar Discussão ganha o ⌄ com a lista.'
      ),
    keywords: 'rascunho rascunhos drafts salvar save automático autosave fof',
    master: 'canela.composer_drafts',
    dependsOn: 'canela.composer_enabled',
    // Os rascunhos são do fof/drafts: sem ele, o tema não tem onde guardá-los.
    extensions: ['fof-drafts'],
    body: () => (
      <p className="helpText">
        {trans(
          `${KEY}.drafts_note`,
          'Os rascunhos são guardados pelo fof/drafts (tabela drafts), que também cuida das permissões e do agendamento. Edições de postagens não têm rascunho.'
        )}
      </p>
    ),
  },
  {
    id: 'hashtags',
    group: 'composer',
    icon: 'fas fa-hashtag',
    title: () => trans(`${KEY}.section_hashtags`, '#tag'),
    description: () =>
      trans(
        `${KEY}.hashtags_help`,
        'Digitar # no editor sugere as tags e insere um link para elas; nos posts, esses links (e as menções de tag da extensão Menções) viram a pílula com o símbolo da tag.'
      ),
    keywords: 'hashtag # categoria etiqueta tag link autocompletar autocomplete pílula',
    master: 'canela.composer_hashtags',
    dependsOn: 'canela.composer_enabled',
    extensions: ['flarum-tags'],
    body: () =>
      isExtensionEnabled('flarum-mentions') ? (
        <AdminNotice>
          {trans(
            `${KEY}.hashtags_mentions_notice`,
            'Com a extensão Menções ligada, o # do editor é dela (menção de tag); o tema só desenha as menções como hashtags do Discourse.'
          )}
        </AdminNotice>
      ) : null,
  },
];

export default cards;
