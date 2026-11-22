/*
 * Aviso de que o `composer update` não vai trazer a próxima versão do tema: a
 * constraint do composer.json do fórum trava (`^0.1.11` em 0.x, ou uma versão
 * exata). Quem diz é o backend (src/Update/UpdateBlocker), só para admin.
 */
import app from 'flarum/admin/app';

const KEY = 'ramon-canela.admin.settings.shell';
const COMMAND = 'composer require ramon/canela:"*" -W';

const UpdateNotice: any = {
  view() {
    const constraint = app.forum.attribute<string | null>('canelaUpdateBlocker');

    if (!constraint) return null;

    return (
      <div className="CanelaAdmin-notice CanelaAdmin-updateNotice" role="status">
        <i className="fas fa-triangle-exclamation" aria-hidden="true" />
        <span>
          {app.translator.trans(`${KEY}.update_blocked`, { constraint: <code>{`"ramon/canela": "${constraint}"`}</code> })}{' '}
          {app.translator.trans(`${KEY}.update_blocked_fix`)}
          <code className="CanelaAdmin-updateCommand">{COMMAND}</code>
        </span>
      </div>
    );
  },
};

export default UpdateNotice;
