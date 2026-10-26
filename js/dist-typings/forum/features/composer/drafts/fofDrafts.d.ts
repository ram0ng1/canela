import type Discussion from 'flarum/common/models/Discussion';
/** O modelo `Draft` do fof/drafts (só o que o tema usa). */
export interface FofDraft {
    id(): string | undefined;
    exists: boolean;
    title(): string | null;
    content(): string;
    updatedAt(): Date | null | undefined;
    type(): 'reply' | 'privateDiscussion' | 'discussion';
    icon(): string;
    relationships(): Record<string, any> | null;
    loadRelationships(force?: boolean): Record<string, any>;
    save(data: Record<string, unknown>): Promise<FofDraft>;
    delete(body?: unknown, options?: unknown): Promise<void>;
}
interface FofDraftsState {
    loading: boolean;
    loadingMore: boolean;
    hasNextPage: boolean;
    load(): void;
    loadMore(): void;
    deleteDraft(draft: FofDraft): void;
    showComposer(draft: FofDraft): Promise<unknown> | undefined;
}
export declare function fofDraftsInstalled(): boolean;
/** Rascunhos valem agora: extensão ligada, pessoa logada com permissão e o recurso ligado no admin do tema. */
export declare function draftsOn(): boolean;
export declare function fofState(): FofDraftsState | null;
/** O fof/drafts guarda tópico novo e resposta; edição e mensagem do flarum/messages, não. */
export declare function draftableBody(): boolean;
export declare function draftsLoaded(): boolean;
export declare function allDrafts(): FofDraft[];
/** Quantos rascunhos a pessoa tem: o que já veio do servidor, ou a contagem do usuário antes disso. */
export declare function draftCount(): number;
/** Pede a primeira página ao fof (uma vez por sessão) e avisa quando terminou. */
export declare function loadDrafts(): Promise<void>;
/** Há o que guardar: o fof só guarda rascunho com texto. */
export declare function hasContent(): boolean;
/** O texto mudou desde o último salvamento (o `changed()` que o fof põe no ComposerState). */
export declare function draftChanged(): boolean;
/**
 * Salva o composer aberto no fof. Diferente do `saveDraft()` do fof, devolve a
 * promessa e só pendura o rascunho criado no composer se ele ainda é o mesmo:
 * salvar e fechar logo em seguida não deixa um rascunho velho no composer
 * seguinte (que passaria a gravar por cima dele).
 */
export declare function saveCurrentDraft(): Promise<void>;
/** Apaga o rascunho do composer aberto, se houver. */
export declare function discardCurrentDraft(): Promise<void>;
/** O estado discreto do rodapé: salvando, salvo há pouco (até 3 s) ou nada. */
export declare function draftStatus(): 'saving' | 'saved' | 'error' | null;
export declare function draftDiscussion(draft: FofDraft): Discussion | null;
export declare function replyDraftDiscussionId(draft: FofDraft): string | null;
/**
 * O fof não manda o tópico junto com o rascunho de resposta, e o título dele
 * é o que a lista mostra ("RE: …"). Busca os que faltam, um por vez.
 */
export declare function ensureDiscussions(drafts: FofDraft[]): void;
/** O ícone do tipo: ↩ resposta, ✉ mensagem, ✎ tópico. */
export declare function draftIcon(draft: FofDraft): string;
/** O título da linha: "RE: <tópico>" na resposta, o título (ou o começo do texto) no tópico novo. */
export declare function draftTitle(draft: FofDraft): string;
/** Reabre o composer com o rascunho; numa resposta, vai antes para o tópico. */
export declare function openDraft(draft: FofDraft): void;
export declare function deleteDraft(draft: FofDraft): void;
export {};
