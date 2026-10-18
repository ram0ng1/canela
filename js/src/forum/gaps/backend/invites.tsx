/*
 * Links de convite do Discourse (invite-panel / generated-invite-link):
 *
 * - "Convidar" na janela de compartilhar (e no menu "Mais" da barra
 *   lateral) abre a janela que gera um link com validade e número de usos,
 *   com o botão de copiar e a lista dos convites já feitos;
 * - quem chega por /invites/{código} cai na página inicial com o código no
 *   endereço, e o fórum abre o cadastro com "Fulano convidou você";
 * - o cadastro leva o código junto (canelaInviteCode), e o servidor avisa
 *   quem convidou.
 *
 * Tudo depende do backend dos recursos (extend/gaps.php) e da permissão de
 * convidar (canelaCanInvite).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import CanelaSidebar from '../../components/CanelaSidebar';
import { gapsBackend } from '../settings';
import { forumBool, t } from '../../utils/settings';

const STORAGE_KEY = 'canela.inviteCode';

export function canInvite(): boolean {
  return gapsBackend() && forumBool('canelaInvitesEnabled', true) && !!app.session.user && !!app.forum.attribute<boolean>('canelaCanInvite');
}

/** A janela de convites mora num chunk (InviteModal): desce no clique. */
export function openInviteModal(stack = false): void {
  app.modal.show(() => import('./InviteModal'), {}, stack);
}

export function apiUrl(path: string): string {
  return `${app.forum.attribute<string>('apiUrl')}${path}`;
}

function storedCode(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Quem chegou por um link de convite: guarda o código e abre o cadastro. */
function handleArrival(): void {
  const code = new URLSearchParams(window.location.search).get('canelaInvite');

  if (!code || app.session.user || !/^[A-Za-z0-9]{32}$/.test(code)) return;

  try {
    sessionStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Sem sessionStorage o cadastro segue, só sem contar o convite.
  }

  // O código sai do endereço: recarregar a página não deve reabrir a janela.
  const url = new URL(window.location.href);
  url.searchParams.delete('canelaInvite');
  history.replaceState(history.state, '', url.toString());

  app
    .request<{ valid: boolean; inviter: string | null; signUpOpen: boolean }>({ method: 'GET', url: apiUrl(`/canela-invite-info/${code}`) })
    .then((info) => {
      if (!info.valid) return;

      if (info.inviter) app.alerts.show({ type: 'success' }, t('gaps.invites.invited_by', { username: info.inviter }));
      if (info.signUpOpen) app.modal.show(() => (flarum as any).reg.asyncModuleImport('flarum/forum/components/SignUpModal'));
    })
    .catch(() => {});
}

export default function installInvites(): void {
  extend(app as any, 'mount', () => {
    if (gapsBackend() && forumBool('canelaInvitesEnabled', true)) handleArrival();
  });

  // O código vai junto do cadastro; o servidor conta o uso e avisa quem convidou.
  extend('flarum/forum/components/SignUpModal' as any, 'submitData', function (data: any) {
    const code = storedCode();

    if (code && gapsBackend() && data && typeof data === 'object') data.canelaInviteCode = code;
  });

  extend(CanelaSidebar.prototype, 'moreItems', function (items: ItemList<Mithril.Children>) {
    if (!canInvite()) return;

    items.add(
      'canelaInvite',
      <Button icon="fas fa-user-plus" onclick={() => openInviteModal()}>
        {t('gaps.invites.sidebar')}
      </Button>,
      15
    );
  });
}
