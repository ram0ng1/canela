import { AdminComponent } from '../util';
/**
 * Inteiro com mínimo e máximo, que salva sozinho.
 *
 * Enquanto se digita, o campo mostra o rascunho (`draft`) e só grava o que
 * estiver dentro da faixa: limitar a cada tecla tornaria impossível digitar
 * "15" com mínimo 3 (o "1" viraria "3" na hora), e um campo apagado no meio da
 * edição não pode ir para o banco como vazio. Ao sair do campo o valor é
 * ajustado à faixa e o rascunho some.
 */
export default class AdminNumber extends AdminComponent {
    draft: string | null;
    saveTimer: ReturnType<typeof setTimeout> | undefined;
    view(): JSX.Element;
    handleInput(rawValue: string): void;
    commitDraft(): void;
    store(value: number, delayMs: number): void;
    parse(rawValue: string): number | null;
}
