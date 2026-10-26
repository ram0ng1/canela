import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
export interface TrustLevelModalAttrs extends IFormModalAttrs {
    user: User;
}
/**
 * Alterar o nível de confiança à mão (só admin) — o único caminho para o 4,
 * Líder. Escolher um nível já o fixa (o servidor faz isso); o interruptor
 * deixa soltar de novo, para o sistema voltar a promover e rebaixar.
 */
export default class TrustLevelModal extends FormModal<TrustLevelModalAttrs> {
    level: number;
    locked: boolean;
    oninit(vnode: Mithril.Vnode<TrustLevelModalAttrs, this>): void;
    className(): string;
    title(): string;
    content(): JSX.Element;
    onsubmit(e: SubmitEvent): void;
}
