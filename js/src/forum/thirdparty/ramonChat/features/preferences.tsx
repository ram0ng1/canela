/*
 * A seção "Chat" das Configurações (a aba Chat das preferências do tema), como
 * a do Discourse e a do chat próprio do tema (features/chat/preferences.tsx),
 * gravando as preferências que o ramon/chat registra (`ramon-chat.enabled`,
 * `allowChannelWideMentions`, `sound`, `emailNotifications`, `openInDrawer`,
 * `sendWithCtrlEnter`) e as do tema (indicador do cabeçalho, reações de um
 * clique). O ramon/chat não tem tela para nenhuma delas.
 *
 * Cada controle grava sozinho (`savePreferences`), como os do core. O
 * SettingsPage vem num chunk: o extend usa o nome do módulo.
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

import { ct, feature, ramonChatPreferencesOn, rt } from './flags';

interface PrefsAttrs extends ComponentAttrs {
  user: User;
}

/**
 * O som desligado pelo leitor. O ramon/chat grava `ramon-chat.sound` como
 * texto, mas só silencia quando ele vale `false` (utils/sound.ts) — o que um
 * texto nunca vale. Até a correção lá, o tema troca no cliente o som do
 * fórum por "none" para quem escolheu "Nenhum": é o que o `chosen()` dele lê.
 */
export function applySoundPreference(): void {
  const forum = app.forum as any;
  const attrs = forum?.data?.attributes;

  if (!attrs) return;

  if (forum.__canelaSound === undefined) forum.__canelaSound = attrs['ramon-chat.notificationSound'];

  const silenced = app.session.user?.preferences()?.['ramon-chat.sound'] === 'none';

  attrs['ramon-chat.notificationSound'] = silenced ? 'none' : forum.__canelaSound;
}

class RamonChatPreferences extends Component<PrefsAttrs> {
  private saving = new Set<string>();

  view(): Mithril.Children {
    const prefs = (this.attrs.user.preferences() || {}) as Record<string, any>;
    const enabled = prefs['ramon-chat.enabled'] !== false;

    return (
      <div className="CanelaRamonChatPreferences chat-setting">
        {this.toggle('ramon-chat.enabled', enabled, ct('enable'))}

        {enabled && [
          <div className="Form-group">
            <label>{ct('sound.title')}</label>
            <Select
              value={prefs['ramon-chat.sound'] === 'none' ? 'none' : 'default'}
              options={{ default: rt('preferences.sound_default'), none: ct('sounds.none') }}
              onchange={(value: string) => this.save('ramon-chat.sound', value)}
            />
          </div>,

          feature('header_indicator') && (
            <div className="Form-group">
              <label>{ct('header_indicator_preference.title')}</label>
              <Select
                value={prefs.canelaRamonChatHeaderIndicator || 'all_new'}
                options={{
                  all_new: ct('header_indicator_preference.all_new'),
                  dm_and_mentions: ct('header_indicator_preference.dm_and_mentions'),
                  only_mentions: ct('header_indicator_preference.only_mentions'),
                  never: ct('header_indicator_preference.never'),
                }}
                onchange={(value: string) => this.save('canelaRamonChatHeaderIndicator', value)}
              />
            </div>
          ),

          <div className="Form-group">
            <label>{ct('send_shortcut.title')}</label>
            <Select
              value={prefs['ramon-chat.sendWithCtrlEnter'] === 'ctrl' ? 'ctrl' : 'enter'}
              options={{ enter: ct('send_shortcut.enter'), ctrl: ct('send_shortcut.meta_enter') }}
              onchange={(value: string) => this.save('ramon-chat.sendWithCtrlEnter', value)}
            />
          </div>,

          feature('quick_reactions') && (
            <div className="Form-group">
              <label>{ct('quick_reaction_type.title')}</label>
              <Select
                value={prefs.canelaRamonChatQuickReactions || 'frequent'}
                options={{ frequent: ct('quick_reaction_type.options.frequent'), custom: ct('quick_reaction_type.options.custom') }}
                onchange={(value: string) => this.save('canelaRamonChatQuickReactions', value)}
              />
              {prefs.canelaRamonChatQuickReactions === 'custom' && [
                <input
                  className="FormControl"
                  placeholder="heart tada eyes"
                  value={prefs.canelaRamonChatQuickReactionsCustom || ''}
                  onchange={(e: Event) => this.save('canelaRamonChatQuickReactionsCustom', (e.target as HTMLInputElement).value)}
                />,
                <p className="helpText">{rt('preferences.quick_custom_help')}</p>,
              ]}
            </div>
          ),

          this.toggle(
            'ramon-chat.openInDrawer',
            prefs['ramon-chat.openInDrawer'] !== false,
            rt('preferences.open_in_drawer'),
            rt('preferences.open_in_drawer_help')
          ),

          this.toggle('ramon-chat.emailNotifications', prefs['ramon-chat.emailNotifications'] !== false, rt('preferences.email_mentions')),

          // "Ignorar" no texto, como no Discourse; a preferência do ramon/chat é a positiva.
          this.toggle(
            'ramon-chat.allowChannelWideMentions',
            prefs['ramon-chat.allowChannelWideMentions'] === false,
            ct('ignore_channel_wide_mention.title'),
            ct('ignore_channel_wide_mention.description'),
            true
          ),
        ]}
      </div>
    );
  }

  private toggle(key: string, state: boolean, label: string, help?: string, inverted = false): Mithril.Children {
    return (
      <div className="Form-group">
        <Switch state={state} loading={this.saving.has(key)} onchange={(value: boolean) => this.save(key, inverted ? !value : value)}>
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

      if (key === 'ramon-chat.sound') applySoundPreference();

      // Ligar ou desligar o chat muda o fórum inteiro (botão, gaveta, barra):
      // o ramon/chat decide isso no boot, então a página recarrega.
      if (key === 'ramon-chat.enabled') window.location.reload();

      m.redraw();
    });
  }
}

export default function installRamonChatPreferences(): void {
  extend('flarum/forum/components/SettingsPage' as any, 'settingsItems', function (this: any, items: ItemList<Mithril.Children>) {
    const user: User | undefined = this.user;

    if (!user || user !== app.session.user || !ramonChatPreferencesOn()) return;

    items.add(
      'canelaRamonChat',
      <FieldSet className="Settings-canelaRamonChat FieldSet--col" label={ct('title_capitalized')}>
        <RamonChatPreferences user={user} />
      </FieldSet>,
      45
    );
  });
}
