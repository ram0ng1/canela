import { AdminComponent } from '../util';
/**
 * Liga/desliga na hora (o painel redesenha as dependências) e grava. Se a
 * gravação falhar, a chave volta ao valor anterior: o painel não pode mostrar
 * como ligado algo que o servidor não guardou.
 */
export declare const setBool: (settingKey: string, checked: boolean) => Promise<unknown>;
export declare const ExtensionBadge: any;
export default class AdminToggle extends AdminComponent {
    saving: boolean;
    view(): JSX.Element | null;
}
