/*
 * Cards das páginas de comunidade: Sobre, Usuários e Grupos.
 */
import app from 'flarum/admin/app';
import Link from 'flarum/common/components/Link';
import Button from 'flarum/common/components/Button';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

import { AdminComponent, trans, getBool, getStr, saveSetting } from '../util';
import { AdminNotice, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import type { CardDef } from '../types';
import AboutPagesEditor from './aboutPages';

const KEY = 'ramon-canela.admin.settings.community';

const SAVE_DELAY_MS = 600;

/**
 * Texto que salva sozinho, um tempo depois de a pessoa parar de digitar —
 * uma requisição por pausa, não por tecla. O valor vai para `app.data` na
 * hora, para o campo não "voltar" num redesenho antes de o POST terminar.
 */
class AdminTextField extends AdminComponent {
  saveTimer: ReturnType<typeof setTimeout> | undefined;

  onremove(vnode: any) {
    super.onremove(vnode);

    // Sair da página no meio da pausa não pode perder o que foi digitado.
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.flush();
    }
  }

  view() {
    const { settingKey, label, help, multiline, type = 'text', placeholder } = this.attrs;
    const value = getStr(settingKey);
    const id = `CanelaAdmin-${settingKey.replace(/\W+/g, '-')}`;
    const oninput = (event: InputEvent) => this.store((event.target as HTMLInputElement | HTMLTextAreaElement).value);

    return (
      <div className="Form-group">
        <label className="CanelaAdmin-label" for={id}>
          {label}
        </label>
        {multiline ? (
          <textarea id={id} className="FormControl CanelaAdmin-textarea" rows={8} value={value} placeholder={placeholder} oninput={oninput} />
        ) : (
          <input id={id} className="FormControl" type={type} value={value} placeholder={placeholder} oninput={oninput} />
        )}
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }

  store(value: string): void {
    app.data.settings[this.attrs.settingKey] = value;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  flush(): void {
    this.saveTimer = undefined;
    saveSetting({ [this.attrs.settingKey]: getStr(this.attrs.settingKey) });
  }
}

const toggle = (name: string, label: string, help: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} />
);

const text = (name: string, label: string, help: string, extra: Record<string, any> = {}) => (
  <AdminTextField settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} {...extra} />
);

/**
 * Com o fof/pages: qual página vira as Diretrizes, e o botão que cria a página
 * "Diretrizes" com o texto atual. Escolhida uma página, o texto abaixo deixa
 * de valer e o conteúdo passa a ser editado no fof/pages.
 */
class GuidelinesPagePicker extends AdminComponent {
  pages: { id: string; title: string }[] | null = null;
  creating = false;

  oninit(vnode: any) {
    super.oninit(vnode);
    this.load();
  }

  load() {
    app
      .request<any>({ method: 'GET', url: `${app.forum.attribute('apiUrl')}/pages`, params: { 'page[limit]': 50 } })
      .then((res) => {
        this.pages = (res?.data || []).map((p: any) => ({ id: String(p.id), title: String(p.attributes?.title || p.id) }));
        m.redraw();
      })
      .catch(() => {
        this.pages = [];
        m.redraw();
      });
  }

  create() {
    this.creating = true;
    app
      .request<{ pageId: number }>({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/canela-guidelines/page` })
      .then((res) => {
        app.data.settings['canela.guidelines_page'] = String(res.pageId);
        this.load();
      })
      .finally(() => {
        this.creating = false;
        m.redraw();
      });
  }

  view() {
    const current = getStr('canela.guidelines_page');
    const page = this.pages?.find((p) => p.id === current);

    return (
      <div className="Form-group CanelaAdmin-guidelinesPage">
        <label>{trans(`${KEY}.guidelines_page_label`, 'Página do fof/pages')}</label>
        <select
          className="FormControl"
          value={current}
          disabled={this.pages === null}
          onchange={(e: Event) => {
            const value = (e.target as HTMLSelectElement).value;
            app.data.settings['canela.guidelines_page'] = value;
            saveSetting({ 'canela.guidelines_page': value });
          }}
        >
          <option value="">{trans(`${KEY}.guidelines_page_none`, 'Nenhuma: usar o texto abaixo')}</option>
          {(this.pages || []).map((p) => (
            <option value={p.id}>{p.title}</option>
          ))}
        </select>
        <p className="helpText">
          {trans(
            `${KEY}.guidelines_page_help`,
            'Escolhida uma página, o /guidelines mostra o conteúdo dela (com a visibilidade do próprio fof/pages) e o texto abaixo deixa de valer. O conteúdo passa a ser editado em fof/pages. Com o texto vazio, a página criada parte do modelo do tema, inspirado nas diretrizes do Discourse.'
          )}
        </p>
        {!page && (
          <Button className="Button" loading={this.creating} disabled={this.pages === null} onclick={() => this.create()}>
            {trans(`${KEY}.guidelines_page_create`, 'Criar a página "Diretrizes" com o texto atual')}
          </Button>
        )}
      </div>
    );
  }
}

/** Um link para a página no fórum, para conferir o resultado. */
const viewLink = (path: string) => (
  <p className="CanelaAdmin-viewLink">
    <Link href={app.forum.attribute<string>('baseUrl') + path} external={true} target="_blank">
      {trans(`${KEY}.view_page`, 'Ver a página no fórum')} <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
    </Link>
  </p>
);

const help = (name: string, fallback: string) => () => trans(`${KEY}.${name}_help`, fallback);

const COMMUNITY_CARDS: CardDef[] = [
  {
    id: 'about',
    group: 'community',
    icon: 'fas fa-circle-info',
    title: () => trans(`${KEY}.section_about`, 'Página Sobre'),
    description: help(
      'about_enabled',
      'A página do Discourse com a descrição do fórum, um texto seu, o contato, a equipe e os números do site. Ganha um link no menu "Mais" da barra lateral.'
    ),
    keywords: 'sobre about equipe staff administradores admins moderadores moderators estatísticas stats contato contact e-mail email texto text',
    master: 'canela.about_enabled',
    body: () => (
      <>
        {text(
          'about_text',
          'Texto sobre o fórum',
          'Aparece abaixo do título. Aceita Markdown e BBCode (os que o fórum tiver ligados); se o texto tiver tags HTML, ele vai como HTML, sem formatação.',
          { multiline: true }
        )}
        <SubDivider />
        {text('about_contact_email', 'E-mail de contato', 'Mostrado na caixa "Fale conosco". Fica público: use um endereço da equipe.', {
          type: 'email',
          placeholder: 'contato@exemplo.com',
        })}
        {text('about_contact_url', 'Página de contato', 'Um endereço completo (https://…) para um formulário ou página de contato.', {
          type: 'url',
          placeholder: 'https://',
        })}
        <SubDivider />
        {toggle(
          'about_show_staff',
          'Mostrar a equipe',
          'As listas "Nossos administradores" e "Nossos moderadores". Grupos ocultos ficam de fora para quem não pode vê-los.'
        )}
        {toggle(
          'about_show_stats',
          'Mostrar as estatísticas do site',
          'Discussões, postagens, cadastros, usuários ativos e curtidas nas últimas 24 horas, 7 dias, 30 dias e desde sempre.'
        )}
        {getBool('canela.about_show_stats') && (
          <AdminNotice>{trans(`${KEY}.stats_notice`, 'Os números contam só o que é público e são recalculados a cada 30 minutos.')}</AdminNotice>
        )}
        {viewLink('/about')}
      </>
    ),
  },
  {
    id: 'guidelines',
    group: 'community',
    icon: 'fas fa-scale-balanced',
    title: () => trans(`${KEY}.guidelines_enabled_label`, 'Página Diretrizes (/guidelines)'),
    description: help(
      'guidelines_enabled',
      'As regras de convivência do fórum, numa aba ao lado de Sobre e no menu "Mais" da barra lateral. /faq leva à mesma página, como no Discourse. A página só aparece com conteúdo (o texto abaixo ou uma página do fof/pages).'
    ),
    keywords: 'diretrizes guidelines faq regras rules convivência',
    master: 'canela.guidelines_enabled',
    body: () => (
      <>
        {isExtensionEnabled('fof-pages') && <GuidelinesPagePicker />}
        {text(
          'guidelines_text',
          'Texto das diretrizes',
          'Aceita Markdown e BBCode; com tags HTML, vai como HTML. Vazio e sem página do fof/pages, a página Diretrizes não aparece.',
          { multiline: true }
        )}
        {viewLink('/guidelines')}
      </>
    ),
  },
  {
    id: 'about_pages',
    group: 'community',
    icon: 'fas fa-folder-plus',
    title: () => trans(`${KEY}.section_about_pages`, 'Páginas da área Sobre'),
    description: help(
      'about_pages',
      'Acrescente quantas páginas do fof/pages quiser como abas ao lado de Sobre e Diretrizes, cada uma com o layout de regras: título, índice de seções e cartões.'
    ),
    keywords: 'páginas pages fof abas tabs sobre about diretrizes guidelines extras personalizadas custom ordem order ícone icon rótulo label',
    extensions: ['fof-pages'],
    body: () => <AboutPagesEditor />,
  },
  {
    id: 'legal',
    group: 'community',
    icon: 'fas fa-file-contract',
    title: () => trans(`${KEY}.section_legal_links`, 'Termos e privacidade'),
    keywords: 'termos terms tos serviço service privacidade privacy política policy fof terms',
    body: () => (
      <>
        {text(
          'tos_url',
          'Endereço dos Termos de Serviço',
          'A aba "Termos de Serviço" e o endereço /tos levam para cá. Uma política do FoF Terms com "termos" no nome tem preferência.',
          {
            type: 'url',
            placeholder: 'https://',
          }
        )}
        {text(
          'privacy_url',
          'Endereço da Política de Privacidade',
          'A aba "Política de Privacidade" e o endereço /privacy levam para cá. Uma política do FoF Terms com "privacidade" no nome tem preferência.',
          { type: 'url', placeholder: 'https://' }
        )}
        <AdminNotice>
          {trans(
            `${KEY}.legal_notice`,
            'Sem endereço (aqui ou no FoF Terms), a aba não aparece. As outras políticas do FoF Terms entram como abas com o próprio nome.'
          )}
        </AdminNotice>
      </>
    ),
  },
  {
    id: 'directory',
    group: 'community',
    icon: 'fas fa-users',
    title: () => trans(`${KEY}.section_directory`, 'Diretório de usuários'),
    description: help(
      'directory_enabled',
      'A tabela do Discourse com curtidas recebidas e dadas, discussões, respostas e último acesso de cada pessoa, por período, ordenável por coluna.'
    ),
    keywords: 'usuários users diretório directory membros members curtidas likes ranking período period visitantes guests /u',
    master: 'canela.directory_enabled',
    body: () => (
      <>
        {toggle(
          'directory_guests',
          'Visitantes também podem ver',
          'Por padrão, só quem tem a permissão "Ver a lista de usuários" (em Permissões) vê o diretório e os membros dos grupos. Ligado, visitantes sem conta também veem, menos num fórum fechado.'
        )}
        <AdminNotice>
          {trans(
            `${KEY}.directory_notice`,
            'As colunas de curtidas aparecem com a extensão Likes ligada; Visitas e Postagens lidas, com as estatísticas do tema. Ordenar por último acesso segue a permissão do core de ver quando cada um esteve online.'
          )}
        </AdminNotice>
        {viewLink('/u')}
      </>
    ),
  },
  {
    id: 'groups',
    group: 'community',
    icon: 'fas fa-user-group',
    title: () => trans(`${KEY}.section_groups`, 'Grupos'),
    description: help(
      'groups_enabled',
      'Um cartão por grupo, com ícone, cor e número de membros, e uma página para cada um com os membros. Grupos ocultos só aparecem para quem pode vê-los.'
    ),
    keywords: 'grupos groups membros members atividade activity perfil profile insígnias badges /g',
    master: 'canela.groups_enabled',
    body: () => (
      <>
        {toggle('groups_activity', 'Aba Atividade', 'As postagens recentes dos membros na página do grupo.')}
        {toggle(
          'groups_profile_links',
          'Grupos do perfil levam à página do grupo',
          'As pílulas de grupo no cartão do perfil viram links para /g/nome-do-grupo.'
        )}
        {viewLink('/g')}
      </>
    ),
  },
];

export default COMMUNITY_CARDS;
