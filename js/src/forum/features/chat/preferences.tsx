/*
 * A seção "Chat" nas Configurações — as preferências de chat do Discourse:
 * ativar o chat, o som das mensagens novas, o indicador do cabeçalho, a tecla
 * de enviar, as reações de um clique e "Ignorar menções em todo o canal".
 *
 * Cada controle grava sozinho (user.savePreferences), como os do core.
 * O SettingsPage é carregado sob demanda: o extend usa o nome do módulo.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import FieldSet from 'flarum/common/components/FieldSet';
import Switch from 'flarum/common/components/Switch';
import Select from 'flarum/common/components/Select';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { caps, ct, playSound } from './utils';

interface PrefsAttrs extends ComponentAttrs {
  user: User;
}

class ChatPreferences extends Component<PrefsAttrs> {
  private saving = new Set<string>();

  view(): Mithril.Children {
    const user = this.attrs.user;
    const prefs = (user.preferences() || {}) as Record<string, any>;
    const enabled = prefs.canelaChatEnabled !== false;

    return (
      <div className="CanelaChatPreferences chat-setting">
        {this.toggle('canelaChatEnabled', enabled, ct('enable'))}

        {enabled && [
          <div className="Form-group">
            <label>{ct('sound.title')}</label>
            <div className="chat-sound-controls">
              <Select
                value={prefs.canelaChatSound || 'none'}
                options={{ none: ct('sounds.none'), bell: ct('sounds.bell'), ding: ct('sounds.ding') }}
                onchange={(value: string) => {
                  this.save('canelaChatSound', value);
                  playSound(value);
                }}
              />
            </div>
          </div>,
          <div className="Form-group">
            <label>{ct('header_indicator_preference.title')}</label>
            <Select
              value={prefs.canelaChatHeaderIndicator || 'all_new'}
              options={{
                all_new: ct('header_indicator_preference.all_new'),
                dm_and_mentions: ct('header_indicator_preference.dm_and_mentions'),
                only_mentions: ct('header_indicator_preference.only_mentions'),
                never: ct('header_indicator_preference.never'),
              }}
              onchange={(value: string) => this.save('canelaChatHeaderIndicator', value)}
            />
          </div>,
          <div className="Form-group">
            <label>{ct('send_shortcut.title')}</label>
            <Select
              value={prefs.canelaChatSendShortcut || 'enter'}
              options={{ enter: ct('send_shortcut.enter'), meta_enter: ct('send_shortcut.meta_enter') }}
              onchange={(value: string) => this.save('canelaChatSendShortcut', value)}
            />
          </div>,
          <div className="Form-group">
            <label>{ct('quick_reaction_type.title')}</label>
            <Select
              value={prefs.canelaChatQuickReactions || 'frequent'}
              options={{ frequent: ct('quick_reaction_type.options.frequent'), custom: ct('quick_reaction_type.options.custom') }}
              onchange={(value: string) => this.save('canelaChatQuickReactions', value)}
            />
            {prefs.canelaChatQuickReactions === 'custom' && (
              <input
                className="FormControl"
                placeholder="❤️ 👍 😄"
                value={prefs.canelaChatQuickReactionsCustom || ''}
                onchange={(e: Event) => this.save('canelaChatQuickReactionsCustom', (e.target as HTMLInputElement).value)}
              />
            )}
          </div>,
          this.toggle(
            'canelaChatIgnoreChannelWideMention',
            !!prefs.canelaChatIgnoreChannelWideMention,
            ct('ignore_channel_wide_mention.title'),
            ct('ignore_channel_wide_mention.description')
          ),
        ]}
      </div>
    );
  }

  private toggle(key: string, state: boolean, label: string, help?: string): Mithril.Children {
    return (
      <div className="Form-group">
        <Switch state={state} loading={this.saving.has(key)} onchange={(value: boolean) => this.save(key, value)}>
          {label}
        </Switch>
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }

  private save(key: string, value: unknown): void {
    this.saving.add(key);

    this.attrs.user.savePreferences({ [key]: value }).then(() => {
      this.saving.delete(key);

      // Ligar ou desligar o chat muda o que o fórum mostra: o payload do
      // fórum diz o que vale para o leitor, então ele precisa ser recarregado.
      if (key === 'canelaChatEnabled') window.location.reload();

      m.redraw();
    });
  }
}

export default function installChatPreferences(): void {
  extend('flarum/forum/components/SettingsPage' as any, 'settingsItems', function (this: any, items: ItemList<Mithril.Children>) {
    const user: User | undefined = this.user;

    if (!user || user !== app.session.user || !caps().enabled || !caps().allowed) return;

    items.add(
      'canelaChat',
      <FieldSet className="Settings-canelaChat FieldSet--col" label={ct('title_capitalized')}>
        <ChatPreferences user={user} />
      </FieldSet>,
      45
    );
  });
}
