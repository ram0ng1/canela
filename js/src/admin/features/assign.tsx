/*
 * O corpo do card "Atribuir tópico": a conta do assistente de IA, à parte da
 * conta do sistema. Atribuído a ela, o tópico ganha uma resposta da IA do tema.
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';
import Avatar from 'flarum/common/components/Avatar';

import { AdminComponent, trans } from '../util';

const KEY = 'ramon-canela.admin.settings.gaps';
const SETTING = 'canela.assign_bot_user_id';

interface AssistantData {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  slug: string;
}

export default class AssistantCard extends AdminComponent {
  loading = false;
  created: AssistantData | null = null;

  view() {
    const user = this.created || (app.forum.attribute('canelaAssistant') as AssistantData | null);

    if (!user) {
      return (
        <div className="CanelaSystemAdmin">
          <p className="helpText">{trans(`${KEY}.assign_bot_missing`)}</p>
          <Button className="Button" icon="fas fa-robot" loading={this.loading} onclick={() => this.create()}>
            {trans(`${KEY}.assign_bot_create`)}
          </Button>
        </div>
      );
    }

    const avatarUser = { avatarUrl: () => user.avatarUrl, displayName: () => user.displayName, username: () => user.username, color: () => '' };

    return (
      <div className="CanelaSystemAdmin">
        <div className="CanelaSystemAdmin-user">
          <Avatar user={avatarUser as any} />
          <strong>{trans(`${KEY}.assign_bot_created_as`, { name: user.displayName })}</strong>
        </div>
        <p className="helpText">{trans(`${KEY}.assign_bot_help`)}</p>
        <div className="CanelaSystemAdmin-actions">
          <a className="Button" href={`${app.forum.attribute('baseUrl')}/u/${user.slug}`} target="_blank" rel="noopener">
            {trans(`${KEY}.assign_bot_open_profile`)}
          </a>
        </div>
      </div>
    );
  }

  create(): void {
    this.loading = true;

    app
      .request<{ data: AssistantData }>({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/canela/assign-assistant` })
      .then((response) => {
        this.created = response.data;
        app.forum.pushAttributes({ canelaAssistant: response.data });
        app.data.settings[SETTING] = String(response.data.id);
      })
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }
}
