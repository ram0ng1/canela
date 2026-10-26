import TextEditor from 'flarum/common/components/TextEditor';
import type ComposerState from 'flarum/forum/states/ComposerState';
import type EditorDriverInterface from 'flarum/common/utils/EditorDriverInterface';
export type ComposerFeature = 'Emoji' | 'Similar' | 'Hashtags' | 'Drafts' | 'LinkedTopic' | 'Preview';
/**
 * Se um recurso do editor vale agora. Lido a cada uso, e não no install: no
 * initializer o `app.forum` ainda não existe, e o admin pode mudar a opção.
 */
export declare function composerOn(feature: ComposerFeature): boolean;
type ToolbarHook = (this: TextEditor, items: any) => void;
/**
 * Estende `TextEditor#toolbarItems` depois de todas as extensões.
 *
 * O flarum/emoji põe um botão `emoji` na barra, e o seletor do tema precisa
 * tomar o lugar dele. A ordem dos initializers das extensões não é garantida,
 * então o gancho só entra no primeiro `oninit` de um editor: a essa altura
 * todos os initializers já rodaram e o nosso fica por último.
 */
export declare function extendToolbarLate(hook: ToolbarHook): void;
/**
 * O ComposerState de um TextEditor. O TextEditor do core é JS, e as attrs
 * dele chegam ao TypeScript sem tipo; o cast mora só aqui.
 */
export declare function editorComposer(editor: TextEditor): ComposerState | null;
/** O driver do editor (o textarea, ou o editor rico de outra extensão). */
export declare function editorDriver(editor: TextEditor): EditorDriverInterface | null;
export {};
