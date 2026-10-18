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
// O /team do tema avocado (rota de backend `avocado-team`): com o Wardrobe no
// Canela, o JS do avocado não carrega e a página ficava em branco. Aqui ela
// abre a página Sobre (que lista a equipe). Com o JS do avocado presente, a
// rota é dele.
const avocadoTeam = new Extend.Routes().add('avocado-team', '/team', AboutPage);
const avocadoTeamRoute = {
  extend(app: any, extension: any) {
    if ('ramon-avocado' in flarum.extensions) return;
    avocadoTeam.extend(app, extension);
  },
};

export default [
  avocadoTeamRoute,
  new Extend.Routes()
    .add('canela.about', '/about', AboutPage)
    .add('canela.guidelines', '/guidelines', GuidelinesPage)
    .add('canela.faq', '/faq', GuidelinesPage)
    .add('canela.users', '/u', UsersPage)
    .add('canela.groups', '/g', GroupsPage)
    .add('canela.group', '/g/:name', GroupPage),

  new Extend.Model(Group).attribute<number>('canelaMemberCount'),
];
