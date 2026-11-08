/*
 * flarum/audit no visual do tema: o log da discussão, do usuário e o geral
 * (os modais do menu de moderação e do menu do usuário).
 *
 * - Cada entrada ganha o ícone do que mudou (post, tópico, usuário,
 *   configuração…) sobre o avatar, na cor do tipo de ação: verde para o que
 *   cria ou restaura, vermelho para o que oculta ou apaga, âmbar para o que
 *   edita, tranca ou fixa.
 * - A ação vira uma pílula ao lado do nome, sem o " - " entre os dois.
 * - A linha de baixo (IP, cliente, data) é refeita: tempo curto com a data
 *   completa no title, separada por "·".
 * - As entradas são agrupadas por dia ("Hoje", "Ontem", "3 de novembro").
 * - Enter no campo de busca aplica o filtro, sem precisar do botão.
 *
 * Os componentes vêm do registro (o modal é um chunk preguiçoso): o extend
 * espera o chunk carregar. O resto é CSS (less/forum/thirdparty/Audit.less).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Icon from 'flarum/common/components/Icon';
import IPAddress from 'flarum/common/components/IPAddress';
import type Mithril from 'mithril';

import { formatWith, fullDate, shortAge } from '../utils/dates';
import { t } from '../utils/settings';
import { thirdParty } from './settings';

type Tone = 'add' | 'remove' | 'change' | 'neutral';

const TONES: [RegExp, Tone][] = [
  [/(hidden|deleted|suspended|disabled|failed|uninstalled|blocked|attempted)$/, 'remove'],
  [/(created|restored|enabled|unsuspended|activated|approved|registered|installed)$/, 'add'],
  [/(renamed|changed|edited|revised|locked|unlocked|stickied|unstickied|moved|merged|split|tagged|updated|reset|cleared)$/, 'change'],
];

const SUBJECT_ICONS: Record<string, string> = {
  post: 'far fa-comment',
  discussion: 'far fa-comments',
  user: 'far fa-user',
  group: 'fas fa-users',
  tag: 'fas fa-tag',
  extension: 'fas fa-puzzle-piece',
  setting_changed: 'fas fa-sliders',
  permission_changed: 'fas fa-key',
  cache: 'fas fa-broom',
  queue: 'fas fa-layer-group',
};

export function auditTone(action: string): Tone {
  return TONES.find(([pattern]) => pattern.test(action))?.[1] ?? 'neutral';
}

export function auditIcon(action: string): string {
  return SUBJECT_ICONS[action] ?? SUBJECT_ICONS[action.split('.')[0]] ?? 'fas fa-book';
}

/** "Hoje", "Ontem", "3 de novembro" ou "3 de novembro de 2025". */
export function auditDay(date: Date, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86400000);

  if (diff === 0) return t('thirdparty.audit.today');
  if (diff === 1) return t('thirdparty.audit.yesterday');

  return formatWith(
    date,
    date.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }
  );
}

const isDash = (child: any) => child?.tag === '#' && String(child.children).trim() === '-';

function metaRow(log: any): Mithril.Children {
  const parts: Mithril.Children[] = [];
  const date: Date | undefined = log.createdAt();

  if (date) {
    parts.push(
      <time className="CanelaAudit-time" datetime={date.toISOString()} title={fullDate(date)}>
        {shortAge(date)}
      </time>
    );
  }

  if (log.ipAddress()) parts.push(<IPAddress ip={log.ipAddress()} />);

  if (log.client() && log.client() !== 'session') {
    parts.push(<span className="CanelaAudit-client">{app.translator.trans(`flarum-audit.lib.browser.client.${log.client()}`)}</span>);
  }

  return parts.map((part, i) => [
    i > 0 ? (
      <span className="CanelaAudit-dot" aria-hidden="true">
        ·
      </span>
    ) : null,
    part,
  ]);
}

export default function installAudit(): void {
  extend('ext:flarum/audit/common/components/AuditItem' as any, 'view', function (vdom: Mithril.Vnode<any, any>, vnode: any) {
    if (!thirdParty.audit() || !vdom?.attrs) return;

    const log = vnode.attrs.log;
    const action: string = log.action();
    const [avatar, data] = (vdom.children as any[]) ?? [];

    vdom.attrs.className += ` CanelaAudit-item CanelaAudit-item--${auditTone(action)}`;

    if (avatar && Array.isArray(avatar.children)) {
      avatar.children.push(
        <span className="CanelaAudit-badge" aria-hidden="true">
          <Icon name={auditIcon(action)} />
        </span>
      );
    }

    const rows = Array.isArray(data?.children)
      ? data.children.filter((child: any) => String(child?.attrs?.className || '').includes('AuditItemRow'))
      : [];
    const [head, , meta] = rows;

    if (head && Array.isArray(head.children)) {
      head.children = head.children.filter((child: any) => !isDash(child));
      const actionButton = head.children[head.children.length - 1];
      if (actionButton?.attrs) actionButton.attrs.className = `${actionButton.attrs.className || ''} CanelaAudit-action`;
    }

    // Refeita como um vnode novo: filhos trocados depois do m() não são normalizados.
    if (meta) data.children[data.children.indexOf(meta)] = <div className="AuditItemRow CanelaAudit-meta">{metaRow(log)}</div>;
  });

  extend('ext:flarum/audit/common/components/AuditBrowser' as any, 'view', function (this: any, vdom: Mithril.Vnode<any, any>) {
    if (!thirdParty.audit() || !Array.isArray(vdom?.children)) return;

    vdom.attrs = { ...(vdom.attrs || {}), className: 'CanelaAudit' };

    const list = vdom.children.find((child: any) => child?.attrs?.className === 'AuditList') as Mithril.Vnode<any, any> | undefined;

    if (!list || !Array.isArray(list.children)) return;

    // Um cabeçalho a cada dia novo; as entradas vêm da mais nova para a mais antiga.
    const grouped: Mithril.Children[] = [];
    let current = '';

    for (const item of list.children as any[]) {
      const date: Date | undefined = item?.attrs?.log?.createdAt?.();
      const day = date ? auditDay(date) : '';

      if (day && day !== current) {
        current = day;
        grouped.push(<h4 className="CanelaAudit-day">{day}</h4>);
      }

      grouped.push(item);
    }

    list.children = grouped as any;
  });

  extend('ext:flarum/audit/common/components/AuditBrowser' as any, 'oncreate', function (this: any) {
    const input = this.element?.querySelector('.AuditSearch .FormControl') as HTMLInputElement | null;

    input?.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.isComposing) return;

      event.preventDefault();
      this.autocompleteFocused = false;
      this.refresh();
    });
  });
}
