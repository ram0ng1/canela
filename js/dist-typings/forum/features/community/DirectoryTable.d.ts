import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import type DirectoryState from './DirectoryState';
import type { LoadedRow } from './DirectoryState';
export interface DirectoryTableAttrs extends ComponentAttrs {
    state: DirectoryState;
    /** Texto quando não há ninguém (sem busca). */
    emptyText: string;
}
/**
 * A tabela do diretório: usuário à esquerda, uma coluna por
 * número, cabeçalhos clicáveis para ordenar e "carregar mais" no fim.
 *
 * "Último acesso" sempre aparece (quando o usuário o divulga), mas só ordena
 * para quem tem a permissão do core — o servidor diz quais colunas ordenam.
 */
export default class DirectoryTable extends Component<DirectoryTableAttrs> {
    view(): Mithril.Children;
    /** As colunas do servidor, mais "Último acesso" quando ele não ordena por ela. */
    displayColumns(): string[];
    header(column: string, label: string, className: string): Mithril.Children;
    row(row: LoadedRow, columns: string[]): Mithril.Children;
    value(row: LoadedRow, column: string): Mithril.Children;
}
