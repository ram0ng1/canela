import type { FofDraft } from '../forum/features/composer/drafts/fofDrafts';

// O que o fof/drafts e o tema penduram no ComposerState.
declare module 'flarum/forum/states/ComposerState' {
  export default interface ComposerState {
    /** fof/drafts: o rascunho do composer aberto. */
    draft?: FofDraft | null;
    /** fof/drafts: salvando agora. */
    saving?: boolean;
    /** fof/drafts: o texto mudou desde o último salvamento. */
    changed?: () => boolean;
    /** fof/drafts: os dados do corpo, no formato do rascunho. */
    data?: () => Record<string, any>;

    /** O último salvamento de rascunho falhou (rodapé do editor). */
    canelaDraftError?: boolean;
    /** Quando o rascunho foi salvo (o "Rascunho salvo" some depois de 3 s). */
    canelaDraftSavedAt?: number;
    /** O botão de enquete do fof/polls, levado para a barra do composer. */
    canelaPoll?: { onclick: () => void; hasPoll: boolean } | null;
  }
}
