import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type User from 'flarum/common/models/User';
export type ImageKind = 'cover' | 'card-background';
export interface ImageFieldAttrs extends ComponentAttrs {
    user: User;
    kind: ImageKind;
    label: string;
    help?: string;
    /** O endereço no formulário (rascunho). */
    value: string;
    oninput: (value: string) => void;
    /** Depois de enviar ou remover: o formulário passa a considerar o novo valor salvo. */
    onstored: (value: string) => void;
}
export default class ImageField extends Component<ImageFieldAttrs> {
    loading: boolean;
    view(): JSX.Element;
    pick(): void;
    upload(file: File): void;
    remove(): void;
    /** A imagem atual veio de um envio (arquivo no fórum) e não de um endereço externo. */
    isStoredFile(): boolean;
    storedValue(): string;
    send(method: 'POST' | 'DELETE', body?: FormData): void;
}
