/*
 * Os modais do chat: "Novo canal" (chat-modal-create-channel) e "Excluir
 * canal" (chat-modal-delete-channel, que pede o nome do canal para confirmar).
 */
import app from 'flarum/forum/app';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Switch from 'flarum/common/components/Switch';
import type Mithril from 'mithril';

import chat from '../ChatStore';
import { go } from './ChannelsList';
import { channelTitle, chatRequest, ct, pushUsers } from '../utils';
import { allTags, isTagsEnabled, sortTags } from '../../../utils/tags';
import type { ChatChannel } from '../types';

export interface CreateChannelModalAttrs extends IInternalModalAttrs {
  inDrawer: boolean;
}

export class CreateChannelModal extends Modal<CreateChannelModalAttrs> {
  private name = '';
  private slug = '';
  private description = '';
  private tagId = '';
  private threading = true;
  private autoJoin = false;

  className(): string {
    return 'chat-modal-create-channel Modal--small';
  }

  title(): Mithril.Children {
    return ct('create_channel.title');
  }

  content(): Mithril.Children {
    const tags = isTagsEnabled() ? sortTags(allTags()) : [];

    return (
      <div className="Modal-body">
        <form className="Form" onsubmit={(e: SubmitEvent) => this.submit(e)}>
          {tags.length > 0 && (
            <div className="Form-group">
              <label>{ct('create_channel.choose_category.label')}</label>
              <select className="FormControl" value={this.tagId} onchange={(e: Event) => (this.tagId = (e.target as HTMLSelectElement).value)}>
                <option value="">{ct('create_channel.choose_category.none')}</option>
                {tags.map((tag) => (
                  <option value={tag.id()}>{tag.name()}</option>
                ))}
              </select>
              <p className="chat-modal-create-channel__hint">{ct('create_channel.choose_category.hint')}</p>
            </div>
          )}
          <div className="Form-group">
            <label>{ct('create_channel.name')}</label>
            <input
              className="FormControl"
              maxlength={100}
              value={this.name}
              oninput={(e: InputEvent) => (this.name = (e.target as HTMLInputElement).value)}
              required
            />
          </div>
          <div className="Form-group">
            <label>{ct('channel_edit_name_slug_modal.slug_label')}</label>
            <input
              className="FormControl"
              maxlength={100}
              placeholder={slugify(this.name)}
              value={this.slug}
              oninput={(e: InputEvent) => (this.slug = (e.target as HTMLInputElement).value)}
            />
            <p className="helpText">{ct('channel_edit_name_slug_modal.slug_description')}</p>
          </div>
          <div className="Form-group">
            <label>{ct('create_channel.description')}</label>
            <textarea
              className="FormControl"
              maxlength={500}
              rows={3}
              value={this.description}
              oninput={(e: InputEvent) => (this.description = (e.target as HTMLTextAreaElement).value)}
            />
          </div>
          {app.forum.attribute<any>('canelaChat')?.threads && (
            <div className="Form-group">
              <Switch state={this.threading} onchange={(value: boolean) => (this.threading = value)}>
                {ct('create_channel.threading.label')}
              </Switch>
            </div>
          )}
          <div className="Form-group">
            <Switch state={this.autoJoin} onchange={(value: boolean) => (this.autoJoin = value)}>
              {ct('settings.auto_join_users_label')}
            </Switch>
            <p className="helpText">{ct('settings.auto_join_users_info_no_category')}</p>
          </div>
          <div className="Form-group">
            <Button type="submit" className="Button Button--primary" loading={this.loading} disabled={!this.name.trim()}>
              {ct('create_channel.create')}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  private async submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    this.loading = true;

    try {
      const result = await chatRequest('POST', '/channels', {
        name: this.name,
        slug: this.slug,
        description: this.description,
        tagId: this.tagId || null,
        threadingEnabled: this.threading,
        autoJoin: this.autoJoin,
      });

      pushUsers(result.users);
      const channel = chat.putChannel(result.channel);

      app.modal.close();
      go({ name: 'channel', channelId: channel.id }, this.attrs.inDrawer);
    } catch (error) {
      this.loaded();
      throw error;
    }
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface DeleteChannelModalAttrs extends IInternalModalAttrs {
  channel: ChatChannel;
}

/** Excluir de vez: só com o nome do canal digitado. */
export class DeleteChannelModal extends Modal<DeleteChannelModalAttrs> {
  private typed = '';

  className(): string {
    return 'chat-modal-delete-channel Modal--small';
  }

  title(): Mithril.Children {
    return ct('channel_delete.title');
  }

  content(): Mithril.Children {
    const name = channelTitle(this.attrs.channel);

    return (
      <div className="Modal-body">
        <div className="chat-modal-delete-channel__instructions">{m.trust(ct('channel_delete.instructions', { name: escape(name) }))}</div>
        <div className="Form-group">
          <input
            className="FormControl"
            placeholder={ct('channel_delete.confirm_channel_name')}
            value={this.typed}
            oninput={(e: InputEvent) => (this.typed = (e.target as HTMLInputElement).value)}
          />
        </div>
        <Button
          className="Button Button--danger"
          loading={this.loading}
          disabled={this.typed.trim().toLowerCase() !== name.trim().toLowerCase()}
          onclick={() => this.remove()}
        >
          {ct('channel_delete.confirm')}
        </Button>
      </div>
    );
  }

  private async remove(): Promise<void> {
    this.loading = true;

    try {
      await chatRequest('DELETE', `/channels/${this.attrs.channel.id}`);
      chat.channels.delete(this.attrs.channel.id);
      app.modal.close();
      app.alerts.show({ type: 'success' }, ct('channel_delete.process_started'));

      if (chat.isFullPage()) m.route.set(app.route('canela.chat'));
      else chat.navigate({ name: 'channels' });
    } catch (error) {
      this.loaded();
      throw error;
    }
  }
}

function escape(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;

  return div.innerHTML;
}
