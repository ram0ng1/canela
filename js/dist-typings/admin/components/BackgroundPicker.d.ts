import { AdminComponent } from '../util';
type Target = 'forum' | 'auth';
/** O fundo gravado (ou o padrão de quem ainda não escolheu). */
export declare function savedBackground(target: Target): string;
export default class BackgroundPicker extends AdminComponent {
    loading: boolean;
    error: string | null;
    target(): Target;
    settingKey(): string;
    imageKey(): string;
    options(): Record<string, string>;
    value(): string;
    view(): JSX.Element;
    url(): string;
    upload(input: HTMLInputElement): void;
    remove(): void;
}
export {};
