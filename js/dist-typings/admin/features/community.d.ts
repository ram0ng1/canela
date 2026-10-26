import { AdminComponent } from '../util';
import type { CardDef } from '../types';
/**
 * Texto que salva sozinho, um tempo depois de a pessoa parar de digitar —
 * uma requisição por pausa, não por tecla. O valor vai para `app.data` na
 * hora, para o campo não "voltar" num redesenho antes de o POST terminar.
 */
export declare class AdminTextField extends AdminComponent {
    saveTimer: ReturnType<typeof setTimeout> | undefined;
    onremove(vnode: any): void;
    view(): JSX.Element;
    store(value: string): void;
    flush(): void;
}
declare const COMMUNITY_CARDS: CardDef[];
export default COMMUNITY_CARDS;
