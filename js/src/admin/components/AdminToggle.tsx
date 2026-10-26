/*
 * Uma opção liga/desliga que salva sozinha.
 *
 * - `dependsOn`: chaves que precisam valer; sem elas a opção SOME (não fica
 *   só apagada) — o pedido do painel é que o que não vale não apareça.
 * - `extension`: extensão sem a qual a opção não faz nada; sem ela a opção
 *   fica à vista, trancada, com "Precisa da extensão X" — para se saber que
 *   existe e o que falta.
 */
import app from 'flarum/admin/app';
import { AdminComponent, extensionName, firstOff, getBool, missingExtension, registerDeps, saveSetting, toList, trans } from '../util';
import { AdminSwitch } from './AdminSwitch';

/**
 * Liga/desliga na hora (o painel redesenha as dependências) e grava. Se a
 * gravação falhar, a chave volta ao valor anterior: o painel não pode mostrar
 * como ligado algo que o servidor não guardou.
 */
export const setBool = (settingKey: string, checked: boolean) => {
  const previous = app.data.settings[settingKey];
  app.data.settings[settingKey] = checked ? '1' : '0';
  m.redraw();

  return saveSetting({ [settingKey]: checked ? '1' : '0' }).catch(() => {
    app.data.settings[settingKey] = previous;
    m.redraw();
  });
};

export const ExtensionBadge: any = {
  view({ attrs: { id } }: any) {
    return (
      <span className="CanelaAdmin-extBadge">
        <i className="fas fa-plug-circle-xmark" aria-hidden="true" />
        {trans('ramon-canela.admin.settings.shell.requires_extension', { name: extensionName(id) })}
      </span>
    );
  },
};

export default class AdminToggle extends AdminComponent {
  saving = false;

  view() {
    const { settingKey, label, help, dependsOn, extension } = this.attrs;
    const deps = toList(dependsOn);
    const extensions = toList(extension);

    if (deps.length || extensions.length) registerDeps(settingKey, { deps, extensions });
    if (firstOff(deps)) return null;

    const missing = missingExtension(extensions);
    const id = `CanelaAdmin-${String(settingKey).replace(/\W+/g, '-')}`;

    return (
      <div className={`Form-group CanelaAdmin-toggle${missing ? ' is-locked' : ''}`}>
        <div className="CanelaAdmin-toggleRow">
          <label className="CanelaAdmin-toggleLabel" for={id}>
            {label}
            {missing && <ExtensionBadge id={missing} />}
          </label>
          <AdminSwitch
            id={id}
            state={!missing && getBool(settingKey)}
            disabled={!!missing}
            saving={this.saving}
            describedBy={help ? `${id}-help` : undefined}
            onchange={(checked: boolean) => {
              this.saving = true;
              setBool(settingKey, checked).finally(() => {
                this.saving = false;
                m.redraw();
              });
            }}
          />
        </div>
        {help && (
          <p className="helpText" id={`${id}-help`}>
            {help}
          </p>
        )}
      </div>
    );
  }
}
