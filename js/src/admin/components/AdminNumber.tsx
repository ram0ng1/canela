import app from 'flarum/admin/app';
import { AdminComponent, getStr, saveSetting } from '../util';

const SAVE_DELAY_MS = 600;

/**
 * Inteiro com mínimo e máximo, que salva sozinho.
 *
 * Enquanto se digita, o campo mostra o rascunho (`draft`) e só grava o que
 * estiver dentro da faixa: limitar a cada tecla tornaria impossível digitar
 * "15" com mínimo 3 (o "1" viraria "3" na hora), e um campo apagado no meio da
 * edição não pode ir para o banco como vazio. Ao sair do campo o valor é
 * ajustado à faixa e o rascunho some.
 */
export default class AdminNumber extends AdminComponent {
  draft: string | null = null;
  saveTimer: ReturnType<typeof setTimeout> | undefined;

  view() {
    const { settingKey, label, help, min, max, fallback, suffix } = this.attrs;
    const stored = getStr(settingKey, String(fallback));

    return (
      <div className="Form-group CanelaAdmin-number">
        <label className="CanelaAdmin-label">{label}</label>
        <div className="CanelaAdmin-numberWrap">
          <input
            className="FormControl CanelaAdmin-numberInput"
            type="number"
            inputmode="numeric"
            step={1}
            min={min}
            max={max}
            value={this.draft ?? stored}
            oninput={(event: InputEvent) => this.handleInput((event.target as HTMLInputElement).value)}
            onblur={() => this.commitDraft()}
          />
          {suffix && <span className="CanelaAdmin-numberSuffix">{suffix}</span>}
        </div>
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }

  handleInput(rawValue: string): void {
    this.draft = rawValue;
    const parsed = this.parse(rawValue);

    if (parsed !== null && parsed >= this.attrs.min && parsed <= this.attrs.max) {
      this.store(parsed, SAVE_DELAY_MS);
    }
  }

  commitDraft(): void {
    if (this.draft === null) return;

    const { settingKey, min, max, fallback } = this.attrs;
    const parsed = this.parse(this.draft) ?? this.parse(getStr(settingKey, String(fallback))) ?? fallback;
    const clamped = Math.min(max, Math.max(min, parsed));

    this.draft = null;
    if (String(clamped) !== getStr(settingKey, String(fallback))) this.store(clamped, 0);
  }

  store(value: number, delayMs: number): void {
    const { settingKey } = this.attrs;

    app.data.settings[settingKey] = String(value);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => saveSetting({ [settingKey]: String(value) }), delayMs);
  }

  parse(rawValue: string): number | null {
    const parsed = Number.parseInt(rawValue, 10);

    return Number.isFinite(parsed) ? parsed : null;
  }
}
