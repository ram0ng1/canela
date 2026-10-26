import type User from 'flarum/common/models/User';
import ChatHeaderIcon from './components/ChatHeaderIcon';
/** Liga o chat depois do primeiro desenho: extensões, gaveta, tempo real e o atalho `-`. */
declare function start(): void;
declare function openDirect(user: User): Promise<void>;
declare const _default: {
    start: typeof start;
    openDirect: typeof openDirect;
    ChatHeaderIcon: typeof ChatHeaderIcon;
};
export default _default;
