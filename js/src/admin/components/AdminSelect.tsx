import app from 'flarum/admin/app';
import { AdminComponent, getStr, saveSetting } from '../util';

export default class AdminSelect extends AdminComponent {
  view() {
    const { settingKey, label, help, options, default: fallback } = this.attrs;
    const keys = Object.keys(options);

    return (
      <div className="Form-group">
        <label className="CanelaAdmin-label">{label}</label>
        <div className="CanelaAdmin-select-wrap">
          <select
            className="FormControl CanelaAdmin-select"
            value={getStr(settingKey, fallback ?? keys[0])}
            onchange={(event: Event) => {
              const value = (event.target as HTMLSelectElement).value;
              app.data.settings[settingKey] = value;
              m.redraw();
              saveSetting({ [settingKey]: value });
            }}
          >
            {keys.map((key) => (
              <option key={key} value={key}>
                {options[key]}
              </option>
            ))}
          </select>
          <i className="fas fa-chevron-down CanelaAdmin-select-chevron" aria-hidden="true" />
        </div>
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }
}
