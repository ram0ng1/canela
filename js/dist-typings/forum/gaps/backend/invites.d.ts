export declare function canInvite(): boolean;
/** Abre a janela: para gerar convites, ou só para revogar os que ainda existem (quem perdeu a permissão). */
export declare function canManageInvites(): boolean;
/** A janela de convites mora num chunk (InviteModal): desce no clique. */
export declare function openInviteModal(stack?: boolean): void;
export declare function apiUrl(path: string): string;
export default function installInvites(): void;
