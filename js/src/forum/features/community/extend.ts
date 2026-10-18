import Extend from 'flarum/common/extenders';
import Group from 'flarum/common/models/Group';

// Páginas carregadas sob demanda (chunk próprio): não pesam na primeira carga.
const AboutPage = () => import('./AboutPage');
const GuidelinesPage = () => import('./GuidelinesPage');
const UsersPage = () => import('./UsersPage');
const GroupsPage = () => import('./GroupsPage');
const GroupPage = () => import('./GroupPage');

/*
 * As rotas existem sempre: os extenders rodam antes de o fórum saber das
 * configurações. Com o recurso desligado o servidor responde 404 a quem chega
 * pelo endereço, os links somem e a página mostra só um aviso.
 */
export default [
  new Extend.Routes()
    .add('canela.about', '/about', AboutPage)
    .add('canela.guidelines', '/guidelines', GuidelinesPage)
    .add('canela.faq', '/faq', GuidelinesPage)
    .add('canela.users', '/u', UsersPage)
    .add('canela.groups', '/g', GroupsPage)
    .add('canela.group', '/g/:name', GroupPage),

  new Extend.Model(Group).attribute<number>('canelaMemberCount'),
];
