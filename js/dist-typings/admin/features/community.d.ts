import { AdminComponent, type LooseAttrs } from '../util';
import type { CardDef } from '../types';
import type Mithril from 'mithril';
/**
 * Texto que salva sozinho, um tempo depois de a pessoa parar de digitar —
 * uma requisição por pausa, não por tecla. O valor vai para `app.data` na
 * hora, para o campo não "voltar" num redesenho antes de o POST terminar.
 */
export declare class AdminTextField extends AdminComponent {
    saveTimer: ReturnType<typeof setTimeout> | undefined;
    onremove(vnode: Mithril.VnodeDOM<LooseAttrs, this>): void;
    view(): JSX.Element;
    store(value: string): void;
    flush(): void;
}
declare const COMMUNITY_CARDS: CardDef[];
export default COMMUNITY_CARDS;
