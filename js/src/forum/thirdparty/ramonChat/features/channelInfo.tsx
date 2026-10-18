/*
 * As Informações do canal (ChannelInfoModal do ramon/chat) e o formulário do
 * canal (ChannelFormModal) com o que o chat do Discourse tem a mais:
 *
 * - (7) o nome do chat em grupo, que qualquer participante muda (pelo
 *   endpoint do tema: o ramon/chat só deixa o moderador do chat);
 * - (11) "Adicionar canal aos favoritos";
 * - (20) o lembrete de retenção ("As mensagens deste canal são mantidas por
 *   N dias"), com as configurações do próprio ramon/chat;
 * - (21) excluir o canal pede o nome dele digitado, em vez do "OK" do
 *   `confirm()` — como o `channel-delete` do Discourse.
 *
 * Os dois modais vêm em chunks do ramon/chat: os extends usam o nome do módulo.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
import type Mithril from 'mithril';

import { apiUrl, attrs, childList, component, ct, feature, findByClass, rt } from './flags';
import { isStarred, toggleStar } from './starred';

function section(label: string, body: Mithril.Children, className = ''): Mithril.Children {
  return (
    <div className={`ChatChannelInfo-section ${className}`.trim()}>
      <div className="ChatChannelInfo-section-label">{label}</div>
      {body}
    </div>
  );
}

/** O nome do grupo, com Salvar. Só numa MD em que o leitor participa. */
function nameSection(modal: any, channel: any): Mithril.Children {
  if (!feature('group_name') || !channel.isDirect?.() || !channel.isFollowing?.() || channel.isArchived?.()) return null;

  modal.__canelaName ??= channel.name?.() || '';

  const save = async () => {
    modal.__canelaSavingName = true;

    try {
      const payload = await app.request<any>({
        method: 'POST',
        url: apiUrl(`/canela-ramon-chat/channels/${channel.id()}/name`),
        body: { data: { attributes: { name: modal.__canelaName } } },
      });

      if (payload?.meta?.serialized) app.store.pushPayload(payload);

      app.alerts.show({ type: 'success' }, ct('settings.saved'));
    } catch {
      // O alerta do core diz o motivo.
    } finally {
      modal.__canelaSavingName = false;
      m.redraw();
    }
  };

  return section(
    ct('about_view.name'),
    <form
      className="CanelaRamonChat-groupName"
      onsubmit={(e: Event) => {
        e.preventDefault();
        save();
      }}
    >
      <input
        className="FormControl"
        maxlength={50}
        placeholder={ct('new_message_modal.create_group_placeholder')}
        value={modal.__canelaName}
        oninput={(e: InputEvent) => (modal.__canelaName = (e.target as HTMLInputElement).value)}
      />
      <Button
        type="submit"
        className="Button"
        loading={!!modal.__canelaSavingName}
        disabled={(modal.__canelaName || '') === (channel.name?.() || '')}
      >
        {ct('save')}
      </Button>
      <p className="helpText">{rt('group_name.help')}</p>
    </form>,
    'CanelaRamonChat-nameSection'
  );
}

function starSection(channel: any): Mithril.Children {
  if (!feature('starred') || !app.session.user) return null;

  return (
    <div className="ChatChannelInfo-section CanelaRamonChat-starSection">
      <Switch state={isStarred(channel.id())} onchange={() => toggleStar(channel.id())}>
        {ct('channel_settings.star_channel')}
      </Switch>
    </div>
  );
}

function retentionSection(channel: any): Mithril.Children {
  const data = attrs();

  if (!feature('retention') || !data) return null;

  const days = channel.isDirect?.() ? data.dmRetentionDays : data.retentionDays;

  return section(
    ct('settings.history_label'),
    <p className="CanelaRamonChat-retention chat-retention-reminder-text">
      {days ? ct('retention_reminders.long', { count: days }) : ct('retention_reminders.indefinitely_long_plain')}
    </p>,
    'CanelaRamonChat-retentionSection'
  );
}

// ─── (21) Excluir com o nome digitado ───────────────────────────────────────

/** O rótulo que o leitor precisa digitar: o nome do canal (ou o que a tela mostra). */
function expectedName(channel: any): string {
  return String(channel.name?.() || channel.displayName?.() || '').trim();
}

/** Roda o `destroy()` original sem o `confirm()` dele: a confirmação já foi o nome digitado. */
function destroyConfirmed(modal: any): void {
  const native = window.confirm;

  modal.__canelaConfirmed = true;
  window.confirm = () => true;

  try {
    modal.destroy();
  } finally {
    window.confirm = native;
    modal.__canelaConfirmed = false;
    modal.__canelaDeleting = false;
  }
}

function deleteConfirmation(modal: any, channel: any): Mithril.Children {
  const expected = expectedName(channel);
  const typed = String(modal.__canelaTyped || '').trim();
  const matches = typed !== '' && typed.toLowerCase() === expected.toLowerCase();

  return (
    <div className="CanelaRamonChat-deleteConfirm">
      <p className="CanelaRamonChat-deleteConfirm-text">{ct('channel_delete.instructions', { name: expected })}</p>
      <input
        className="FormControl"
        placeholder={ct('channel_delete.confirm_channel_name')}
        aria-label={ct('channel_delete.confirm_channel_name')}
        value={modal.__canelaTyped || ''}
        oninput={(e: InputEvent) => (modal.__canelaTyped = (e.target as HTMLInputElement).value)}
        oncreate={(vnode: Mithril.VnodeDOM) => (vnode.dom as HTMLInputElement).focus()}
      />
      <div className="CanelaRamonChat-deleteConfirm-actions">
        <Button className="Button Button--danger" icon="fas fa-trash" disabled={!matches} onclick={() => destroyConfirmed(modal)}>
          {ct('channel_delete.confirm')}
        </Button>
        <Button
          className="Button Button--flat"
          onclick={() => {
            modal.__canelaDeleting = false;
            modal.__canelaTyped = '';
          }}
        >
          {ct('cancel')}
        </Button>
      </div>
    </div>
  );
}

function installDeleteConfirm(modalName: string, sectionMethod: string, dangerClass: string): void {
  override(component(modalName), 'destroy', function (this: any, original: () => Promise<void>) {
    if (!feature('delete_confirm') || this.__canelaConfirmed) return original();

    this.__canelaDeleting = true;
    this.__canelaTyped = '';
    m.redraw();

    return Promise.resolve();
  });

  extend(component(modalName), sectionMethod, function (this: any, vnode: any) {
    if (!this.__canelaDeleting || !vnode) return;

    const channel = this.attrs.channel;
    const danger = findByClass(vnode, dangerClass);

    if (!danger || !channel) return;

    danger.children = [deleteConfirmation(this, channel)];
    danger.text = undefined;
  });
}

export default function installChannelInfo(): void {
  extend(component('ChannelInfoModal'), 'settings', function (this: any, vnode: any) {
    const channel = this.attrs?.channel;

    if (!vnode || !channel) return;

    const children = childList(vnode);
    // Depois do lugar da descrição (o primeiro filho, mesmo vazio), antes das notificações.
    children.splice(1, 0, nameSection(this, channel), starSection(channel), retentionSection(channel));
  });

  installDeleteConfirm('ChannelInfoModal', 'moderation', 'ChatChannelInfo-danger');
  installDeleteConfirm('ChannelFormModal', 'lifecycle', 'ChannelFormModal-lifecycleDanger');
}
