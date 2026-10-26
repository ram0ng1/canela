/*
 * Cards das páginas de comunidade: Sobre, Usuários e Grupos.
 */
import app from 'flarum/admin/app';
import Link from 'flarum/common/components/Link';
import Button from 'flarum/common/components/Button';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

import { AdminComponent, trans, getBool, getStr, saveSetting, type LooseAttrs } from '../util';
import { AdminNotice, SubDivider } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import type { CardDef } from '../types';
import AboutPagesEditor from './aboutPages';
import type Mithril from 'mithril';

const KEY = 'ramon-canela.admin.settings.community';

const SAVE_DELAY_MS = 600;

/**
 * Texto que salva sozinho, um tempo depois de a pessoa parar de digitar —
 * uma requisição por pausa, não por tecla. O valor vai para `app.data` na
 * hora, para o campo não "voltar" num redesenho antes de o POST terminar.
 */
export class AdminTextField extends AdminComponent {
  saveTimer: ReturnType<typeof setTimeout> | undefined;

  onremove(vnode: Mithril.VnodeDOM<LooseAttrs, this>) {
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

const toggle = (name: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} />
);

const text = (name: string, extra: Record<string, any> = {}) => (
  <AdminTextField settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} {...extra} />
);

/**
 * Com o fof/pages: qual página vira as Diretrizes, e o botão que cria a página
 * "Diretrizes" com o texto atual. Escolhida uma página, o texto abaixo deixa
 * de valer e o conteúdo passa a ser editado no fof/pages.
 */
class GuidelinesPagePicker extends AdminComponent {
  pages: { id: string; title: string }[] | null = null;
  creating = false;

  oninit(vnode: Mithril.Vnode<LooseAttrs, this>) {
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
        <label>{trans(`${KEY}.guidelines_page_label`)}</label>
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
          <option value="">{trans(`${KEY}.guidelines_page_none`)}</option>
          {(this.pages || []).map((p) => (
            <option value={p.id}>{p.title}</option>
          ))}
        </select>
        <p className="helpText">{trans(`${KEY}.guidelines_page_help`)}</p>
        {!page && (
          <Button className="Button" loading={this.creating} disabled={this.pages === null} onclick={() => this.create()}>
            {trans(`${KEY}.guidelines_page_create`)}
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
      {trans(`${KEY}.view_page`)} <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
    </Link>
  </p>
);

const help = (name: string) => () => trans(`${KEY}.${name}_help`);

const COMMUNITY_CARDS: CardDef[] = [
  {
    id: 'about',
    group: 'community',
    icon: 'fas fa-circle-info',
    title: () => trans(`${KEY}.section_about`),
    description: help('about_enabled'),
    keywords: 'sobre about equipe staff administradores admins moderadores moderators estatísticas stats contato contact e-mail email texto text',
    master: 'canela.about_enabled',
    body: () => (
      <>
        {text('about_text', { multiline: true })}
        <SubDivider />
        {text('about_contact_email', {
          type: 'email',
          placeholder: 'contato@exemplo.com',
        })}
        {text('about_contact_url', {
          type: 'url',
          placeholder: 'https://',
        })}
        <SubDivider />
        {toggle('about_show_staff')}
        {toggle('about_show_stats')}
        {getBool('canela.about_show_stats') && <AdminNotice>{trans(`${KEY}.stats_notice`)}</AdminNotice>}
        {viewLink('/about')}
      </>
    ),
  },
  {
    id: 'guidelines',
    group: 'community',
    icon: 'fas fa-scale-balanced',
    title: () => trans(`${KEY}.guidelines_enabled_label`),
    description: help('guidelines_enabled'),
    keywords: 'diretrizes guidelines faq regras rules convivência',
    master: 'canela.guidelines_enabled',
    body: () => (
      <>
        {isExtensionEnabled('fof-pages') && <GuidelinesPagePicker />}
        {text('guidelines_text', { multiline: true })}
        {viewLink('/guidelines')}
      </>
    ),
  },
  {
    id: 'about_pages',
    group: 'community',
    icon: 'fas fa-folder-plus',
    title: () => trans(`${KEY}.section_about_pages`),
    description: help('about_pages'),
    keywords: 'páginas pages fof abas tabs sobre about diretrizes guidelines extras personalizadas custom ordem order ícone icon rótulo label',
    extensions: ['fof-pages'],
    body: () => <AboutPagesEditor />,
  },
  {
    id: 'legal',
    group: 'community',
    icon: 'fas fa-file-contract',
    title: () => trans(`${KEY}.section_legal_links`),
    keywords: 'termos terms tos serviço service privacidade privacy política policy fof terms',
    body: () => (
      <>
        {text('tos_url', {
          type: 'url',
          placeholder: 'https://',
        })}
        {text('privacy_url', { type: 'url', placeholder: 'https://' })}
        <AdminNotice>{trans(`${KEY}.legal_notice`)}</AdminNotice>
      </>
    ),
  },
  {
    id: 'directory',
    group: 'community',
    icon: 'fas fa-users',
    title: () => trans(`${KEY}.section_directory`),
    description: help('directory_enabled'),
    keywords: 'usuários users diretório directory membros members curtidas likes ranking período period visitantes guests /u',
    master: 'canela.directory_enabled',
    body: () => (
      <>
        {toggle('directory_guests')}
        <AdminNotice>{trans(`${KEY}.directory_notice`)}</AdminNotice>
        {viewLink('/u')}
      </>
    ),
  },
  {
    id: 'groups',
    group: 'community',
    icon: 'fas fa-user-group',
    title: () => trans(`${KEY}.section_groups`),
    description: help('groups_enabled'),
    keywords: 'grupos groups membros members atividade activity perfil profile insígnias badges /g',
    master: 'canela.groups_enabled',
    body: () => (
      <>
        {toggle('groups_activity')}
        {toggle('groups_profile_links')}
        {viewLink('/g')}
      </>
    ),
  },
];

export default COMMUNITY_CARDS;
