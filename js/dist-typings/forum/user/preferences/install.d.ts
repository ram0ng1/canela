import UserPageResolver from 'flarum/forum/resolvers/UserPageResolver';
import type Mithril from 'mithril';
/**
 * A mesma página para todas as abas: trocar de aba não recria a página (nem o
 * cabeçalho do perfil), só o conteúdo, que lê a aba do endereço.
 */
export declare class PreferencesResolver extends UserPageResolver {
    makeKey(): string;
    render(vnode: Mithril.Vnode<any, any>): Mithril.Children;
}
/**
 * A página das rotas (../extend.ts): o SettingsPage do core (chunk) só para
 * quem está logado; sem usuário, o `show()` dele e os extends das extensões
 * quebrariam.
 */
export declare const PreferencesPage: () => Promise<any>;
export default function installPreferences(): void;
