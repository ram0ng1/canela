/*
 * A mensagem de erro colada ao campo: um parágrafo logo abaixo do controle,
 * com o ícone e `role="alert"` para o leitor de tela anunciar. O controle
 * aponta para ela com `aria-describedby={id}` e `aria-invalid`.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';

export interface FieldErrorAttrs extends ComponentAttrs {
  id: string;
  message?: Mithril.Children;
}

export default class FieldError extends Component<FieldErrorAttrs> {
  view(): Mithril.Children {
    const { id, message } = this.attrs;
    if (!message) return null;

    return (
      <p className="CanelaFieldError" id={id} role="alert">
        <Icon name="fas fa-circle-exclamation" />
        <span>{message}</span>
      </p>
    );
  }
}

/** Os atributos ARIA do controle com erro (vazios quando não há erro). */
export function invalidAttrs(id: string, message: unknown): Record<string, string | undefined> {
  return message ? { 'aria-invalid': 'true', 'aria-describedby': id } : {};
}
