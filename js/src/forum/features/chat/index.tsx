/*
 * Entrada do chat no pacote principal: só a checagem da opção e o que precisa
 * existir mesmo com o chat fora do alcance do leitor (os tipos de notificação
 * nas configurações). O store, a gaveta e a barra lateral moram no chunk
 * `runtime`, pedido antes do primeiro desenho quando o chat está ligado para
 * o leitor; com o chat desligado no admin, nada do chat é baixado.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import HeaderSecondary from 'flarum/forum/components/HeaderSecondary';
import UserControls from 'flarum/forum/utils/UserControls';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { lazyComponent } from '../../utils/lazy';
import { caps, chatOn, ct } from './flags';

type Runtime = (typeof import('./runtime'))['default'];

let runtime: Promise<Runtime> | null = null;

function loadRuntime(): Promise<Runtime> {
  runtime ||= import('./runtime').then(
    (mod) => mod.default,
    (error) => {
      runtime = null;
      throw error;
    }
  );

  return runtime;
}

// Até o chunk chegar, o mesmo botão sem o indicador de não lidas: o cabeçalho
// não muda de largura quando o ícone de verdade entra.
const ChatHeaderIcon = lazyComponent(
  () => loadRuntime().then((r) => r.ChatHeaderIcon),
  () => (
    <a
      className="Button Button--flat Button--icon icon chat-header-icon__button"
      href={app.route('canela.chat')}
      title={ct('open')}
      aria-label={ct('open')}
    >
      <Icon name="far fa-message" />
    </a>
  )
);

/**
 * Apaga os rascunhos do chat que não são de quem está logado agora: depois de
 * sair (ou trocar de conta), as MDs não escritas não ficam no navegador.
 */
function forgetOtherDrafts(): void {
  try {
    const mine = `canela.chat.draft.${app.session.user?.id() || 0}.`;
    const stale: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key?.startsWith('canela.chat.draft.') && !key.startsWith(mine)) stale.push(key);
    }

    stale.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Sem armazenamento: não há o que apagar.
  }
}

export default function installChat(): void {
  // O pedido sai antes do primeiro desenho; a gaveta e o resto ligam quando ele chega.
  app.beforeMount(() => {
    forgetOtherDrafts();

    if (chatOn()) loadRuntime().then((r) => r.start());
  });

  extend(HeaderSecondary.prototype, 'items', function (items: ItemList<Mithril.Children>) {
    if (!chatOn()) return;

    items.add('canelaChat', <ChatHeaderIcon />, 15);
  });

  extend('flarum/forum/components/NotificationGrid' as any, 'notificationTypes', function (items: ItemList<any>) {
    if (!caps().enabled || !caps().allowed) return;

    items.add('canelaChatMention', { name: 'canelaChatMention', icon: 'fas fa-at', label: ct('notifications.settings_mention') });
    items.add('canelaChatMessage', { name: 'canelaChatMessage', icon: 'far fa-message', label: ct('notifications.settings_message') });
  });

  extend(UserControls as any, 'userControls', function (items: ItemList<Mithril.Children>, ...args: unknown[]) {
    const user = args[0] as User;
    const me = app.session.user;

    if (!chatOn() || !caps().canDirectMessage || !me || !user || user === me) return;

    // Com o flarum/messages, as mensagens privadas já têm a própria entrada
    // ("Enviar mensagem"): uma segunda, para a MD do chat, só confundiria.
    if ('flarum-messages' in flarum.extensions) return;

    items.add(
      'canelaChat',
      <Button icon="far fa-message" onclick={() => loadRuntime().then((r) => r.openDirect(user))}>
        {ct('title_capitalized')}
      </Button>,
      90
    );
  });
}
