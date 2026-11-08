/*
 * PWA e push no navegador (backend em extend/push.php):
 *
 * - registra o /sw.js depois do load, sem pesar na primeira pintura;
 * - a coluna "Push" na tabela de notificações (o canal do servidor);
 * - em Configurações → Notificações, o botão que liga ou desliga o push
 *   neste aparelho (pede a permissão do navegador e grava o aparelho).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Component from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool, t } from '../../utils/settings';

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pushKey = () => app.forum.attribute<string | null>('canelaPushKey') || null;
const base = () => String(app.forum.attribute('baseUrl') || '').replace(/\/$/, '');

function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(`${base()}/sw.js`, { scope: `${base()}/` });
}

/** A chave VAPID (base64url) no formato que o PushManager pede. */
function keyBytes(key: string): Uint8Array {
  const raw = atob((key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));

  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function send(method: 'POST' | 'DELETE', body: unknown) {
  return app.request({ method, url: `${app.forum.attribute('apiUrl')}/canela-push-subscriptions`, body });
}

type State = 'loading' | 'unsupported' | 'denied' | 'off' | 'on';

class PushToggle extends Component {
  status: State = 'loading';
  busy = false;

  oninit(vnode: Mithril.Vnode) {
    super.oninit(vnode);

    if (!supported()) {
      this.status = 'unsupported';
      return;
    }

    registration()
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        this.status = Notification.permission === 'denied' ? 'denied' : sub ? 'on' : 'off';
        m.redraw();
      })
      .catch(() => {
        this.status = 'unsupported';
        m.redraw();
      });
  }

  view() {
    const on = this.status === 'on';

    return (
      <div className="CanelaPush">
        <div className="CanelaPush-text">
          <strong>{t('push.title')}</strong>
          <span className="helpText">{t(`push.state_${this.status}`)}</span>
        </div>
        {this.status === 'on' || this.status === 'off' ? (
          <Button
            className={on ? 'Button' : 'Button Button--primary'}
            icon={on ? 'far fa-bell-slash' : 'far fa-bell'}
            loading={this.busy}
            onclick={() => this.toggle()}
          >
            {on ? t('push.disable') : t('push.enable')}
          </Button>
        ) : null}
      </div>
    );
  }

  async toggle() {
    this.busy = true;
    m.redraw();

    try {
      const reg = await registration();
      const current = await reg.pushManager.getSubscription();

      if (current) {
        await send('DELETE', { endpoint: current.endpoint });
        await current.unsubscribe();
        this.status = 'off';
      } else if ((await Notification.requestPermission()) !== 'granted') {
        this.status = 'denied';
      } else {
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(pushKey()!) as BufferSource });
        await send('POST', sub.toJSON());
        this.status = 'on';
      }
    } catch {
      app.alerts.show({ type: 'error' }, t('push.error'));
    }

    this.busy = false;
    m.redraw();
  }
}

export default function installPush(): void {
  // Depois do load: o service worker não disputa banda com o fórum.
  const register = () => {
    if ('serviceWorker' in navigator && (forumBool('canelaPwa', true) || pushKey())) registration().catch(() => {});
  };

  if (document.readyState === 'complete') app.beforeMount(register);
  else window.addEventListener('load', register, { once: true });

  extend('flarum/forum/components/NotificationGrid' as any, 'notificationMethods', function (items: ItemList<any>) {
    if (pushKey()) items.add('push', { name: 'push', icon: 'fas fa-mobile-screen', label: t('push.column') });
  });

  // Pelo nome do módulo: a página de configurações é um pedaço sob demanda.
  extend('flarum/forum/components/SettingsPage' as any, 'notificationsItems', function (items: ItemList<Mithril.Children>) {
    if (pushKey()) items.add('canelaPush', <PushToggle />, 110);
  });
}
