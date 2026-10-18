/*
 * Cards do perfil estendido: os campos do Discourse (bio, local, site,
 * título, status, capa, aniversário), cada um ligado e desligado aqui.
 */
import { trans, getBool, extensionOn } from '../util';
import { AdminNotice, AdminSubGroup, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import AdminNumber from '../components/AdminNumber';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.profile';

const toggle = (name: string, label: string, help: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} />
);

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

const PROFILE_CARDS: CardDef[] = [
  {
    id: 'profile-fields',
    group: 'people',
    icon: 'far fa-id-card',
    title: () => trans(`${KEY}.section_main`, 'Perfil estendido'),
    description: help(
      'profile_enabled',
      'Os campos do Discourse: cada pessoa conta quem é, onde está e o que anda fazendo. Desligado, os campos somem do fórum e da API, mas o que já foi preenchido fica guardado.'
    ),
    keywords: 'perfil profile bio sobre about local location site website aniversário birthday campos fields',
    master: 'canela.profile_enabled',
    body: () => (
      <>
        {toggle(
          'profile_bio',
          'Sobre mim (bio)',
          'Texto curto no perfil e no cartão de usuário. Aceita links, **negrito**, *itálico* e `código`; nenhum HTML.'
        )}
        {getBool('canela.profile_bio') && (
          <AdminSubGroup>
            <AdminNumber
              settingKey="canela.profile_bio_max_length"
              min={100}
              max={3000}
              fallback={1000}
              suffix={trans(`${KEY}.characters_suffix`, 'caracteres')}
              label={trans(`${KEY}.profile_bio_max_length_label`, 'Tamanho máximo da bio')}
              help={trans(`${KEY}.profile_bio_max_length_help`, 'De {min} a {max} caracteres.', { min: 100, max: 3000 })}
            />
          </AdminSubGroup>
        )}
        <SubDivider />
        {toggle('profile_location', 'Localização', 'Cidade ou região, com um ícone de mapa no perfil.')}
        {toggle('profile_website', 'Site', 'Um endereço http ou https, que abre em outra aba e não passa autoridade de busca (nofollow).')}
        {toggle(
          'profile_birthday',
          'Aniversário',
          'Data de nascimento opcional. Os outros veem só o dia e o mês, a menos que a pessoa escolha mostrar o ano.'
        )}
      </>
    ),
  },
  {
    id: 'profile-title',
    group: 'people',
    icon: 'fas fa-medal',
    title: () => trans(`${KEY}.section_title`, 'Título do usuário'),
    description: help('profile_title', 'Um título curto (até 60 caracteres) no perfil, no cartão e ao lado do nome nos posts.'),
    keywords: 'título title cargo distinção abaixo do nome moderação',
    master: 'canela.profile_title',
    dependsOn: 'canela.profile_enabled',
    body: () =>
      toggle(
        'profile_title_self',
        'Cada pessoa escolhe o próprio título',
        'Desligado, só quem pode editar usuários (a moderação) define títulos, como uma distinção dada pela equipe.'
      ),
  },
  {
    id: 'profile-status',
    group: 'people',
    icon: 'far fa-face-smile',
    title: () => trans(`${KEY}.section_status`, 'Status do usuário'),
    description: help(
      'profile_status',
      'Um emoji e uma frase ("🌴 De férias até sexta") ao lado do nome nos posts, no cartão e no avatar do cabeçalho. A pessoa escolhe quando o status some sozinho.'
    ),
    keywords: 'status emoji férias ausente away ocupado busy limpar expira',
    master: 'canela.profile_status',
    dependsOn: 'canela.profile_enabled',
  },
  {
    id: 'profile-cover',
    group: 'people',
    icon: 'far fa-image',
    title: () => trans(`${KEY}.section_cover`, 'Capa e fundo do cartão'),
    description: help(
      'profile_cover',
      'Uma capa larga no topo do perfil e um fundo para o cartão de usuário, como no Discourse. Sem imagem, a capa usa a cor do usuário.'
    ),
    keywords: 'capa cover imagem image fundo background cartão card upload envio url',
    master: 'canela.profile_cover',
    dependsOn: 'canela.profile_enabled',
    body: () => (
      <>
        {toggle(
          'profile_cover_upload',
          'Permitir envio de imagem',
          'As imagens são reduzidas (a capa a 2000px, o cartão a 900px), convertidas para WebP e guardadas em assets/canela-covers. Desligado, só se aceita o endereço https de uma imagem.'
        )}
        {extensionOn('forumaker-profile-cover') && getBool('canela.thirdparty_profile_cover') && (
          <AdminNotice icon="fas fa-panorama">
            {trans(
              `${KEY}.cover_forumaker_notice`,
              'A forumaker/profile-cover está ativa: a capa e o fundo do cartão vêm dela (Integrações → Capa do perfil). As imagens enviadas aqui ficam guardadas, mas não aparecem nem podem ser trocadas enquanto ela mandar.'
            )}
          </AdminNotice>
        )}
        <AdminNotice>
          {trans(
            `${KEY}.cover_notice`,
            'Endereços externos precisam ser https. O navegador de quem visita o perfil busca a imagem direto no outro site.'
          )}
        </AdminNotice>
      </>
    ),
  },
];

export default PROFILE_CARDS;
