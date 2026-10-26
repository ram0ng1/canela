import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
/** Opções do "Limpar depois de…". */
declare const CLEAR_OPTIONS: readonly ["never", "30m", "1h", "4h", "today", "week", "custom"];
type ClearOption = (typeof CLEAR_OPTIONS)[number] | 'current';
interface Draft {
    title: string;
    bio: string;
    location: string;
    website: string;
    birthdayDate: string;
    birthdayShowYear: boolean;
    statusEmoji: string;
    statusText: string;
    statusClear: ClearOption;
    statusCustom: string;
    coverUrl: string;
    cardUrl: string;
}
export interface ProfileSettingsSectionAttrs extends ComponentAttrs {
    user: User;
}
export default class ProfileSettingsSection extends Component<ProfileSettingsSectionAttrs> {
    draft: Draft;
    saved: Draft;
    saving: boolean;
    /** Os títulos que a pessoa pode escolher sozinha: os emblemas que ganhou e que viram título. */
    titleOptions: string[] | null;
    oninit(vnode: Mithril.Vnode<ProfileSettingsSectionAttrs, this>): void;
    /** Sem poder editar o usuário, o servidor só aceita o nome de um emblema ganho que vira título. */
    titleFromBadges(user: User): boolean;
    loadTitleOptions(user: User): void;
    /** Lê o usuário de novo: depois de salvar, o salvo vira o ponto de partida. */
    reset(): void;
    view(): JSX.Element;
    titleField(user: User): Mithril.Children;
    textField(key: 'title' | 'location' | 'website', label: string, max: number, placeholder: string, type: string, help?: string): Mithril.Children;
    bioField(): Mithril.Children;
    birthdayField(): Mithril.Children;
    statusField(): Mithril.Children;
    /** Sem envio e sem endereço externo, os campos de imagem não têm como receber nada. */
    imagesAvailable(): boolean;
    coverField(user: User): Mithril.Children;
    cardField(user: User): Mithril.Children;
    dirty(): boolean;
    /** Só o que mudou: um campo desligado no admin nunca vai, e a API recusaria. */
    payload(): Record<string, unknown>;
    /** A data em que o status some, calculada na hora de salvar (e não ao escolher). */
    statusUntil(): Date | null;
    submit(event: SubmitEvent): void;
}
export {};
