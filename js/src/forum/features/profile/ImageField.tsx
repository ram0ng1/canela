/*
 * Campo de imagem do perfil (capa ou fundo do cartão): prévia, envio de
 * arquivo e, como alternativa, o endereço https de uma imagem.
 *
 * O envio vai na hora para a rota própria (`/users/{id}/canela-<tipo>`), como
 * o avatar do core; o endereço segue com o resto do formulário, no "Salvar".
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import type User from 'flarum/common/models/User';

import { t } from '../../utils/settings';
import { coverUploadEnabled, cssImage, externalImagesEnabled } from './data';

export type ImageKind = 'cover' | 'card-background';

/** O mesmo teto do servidor (ProfileImageValidator), para avisar antes de enviar 4 MB à toa. */
const MAX_BYTES = 4096 * 1024;

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

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
  loading = false;

  view() {
    const { kind, label, help, value } = this.attrs;
    const id = `CanelaProfile-${kind}`;
    const preview = /^https?:\/\//i.test(value) ? value : null;

    return (
      <div className={`Form-group CanelaProfileImage CanelaProfileImage--${kind}`}>
        <label for={id}>{label}</label>

        <div
          className={`CanelaProfileImage-preview${preview ? ' has-image' : ''}`}
          style={preview ? { backgroundImage: cssImage(preview) } : undefined}
          aria-hidden="true"
        >
          {!preview && <span className="CanelaProfileImage-empty">{t('profile.settings.no_image')}</span>}
        </div>

        <div className="CanelaProfileImage-controls">
          {coverUploadEnabled() && (
            <Button className="Button" icon="fas fa-upload" loading={this.loading} onclick={() => this.pick()}>
              {t('profile.settings.upload')}
            </Button>
          )}
          {preview && (
            <Button
              className="Button Button--icon"
              icon="fas fa-trash"
              aria-label={t('profile.settings.remove_image')}
              title={t('profile.settings.remove_image')}
              disabled={this.loading}
              onclick={() => this.remove()}
            />
          )}
        </div>

        {externalImagesEnabled() && (
          <input
            id={id}
            className="FormControl"
            type="url"
            inputmode="url"
            maxlength={255}
            placeholder="https://"
            value={value}
            oninput={(event: InputEvent) => this.attrs.oninput((event.target as HTMLInputElement).value)}
          />
        )}
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }

  pick() {
    if (this.loading) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) this.upload(file);
    };
    input.click();
  }

  upload(file: File) {
    if (file.size > MAX_BYTES) {
      app.alerts.show({ type: 'error' }, t('profile.settings.image_too_large', { max: '4 MB' }));
      return;
    }

    const body = new FormData();
    body.append('image', file);

    this.send('POST', body);
  }

  remove() {
    if (this.attrs.value && !this.isStoredFile()) {
      // Só um endereço digitado e ainda não salvo: basta limpar o campo.
      this.attrs.oninput('');
      return;
    }

    this.send('DELETE');
  }

  /** A imagem atual veio de um envio (arquivo no fórum) e não de um endereço externo. */
  isStoredFile(): boolean {
    const stored = this.storedValue();

    return !!stored && stored === this.attrs.value;
  }

  storedValue(): string {
    const attribute = this.attrs.kind === 'cover' ? 'canelaCoverUrl' : 'canelaCardBackgroundUrl';

    return this.attrs.user.attribute<string | null>(attribute) || '';
  }

  send(method: 'POST' | 'DELETE', body?: FormData) {
    const user = this.attrs.user;

    this.loading = true;
    m.redraw();

    app
      .request<any>({
        method,
        url: `${app.forum.attribute('apiUrl')}/users/${user.id()}/canela-${this.attrs.kind}`,
        // FormData vai como está; o core serializaria em JSON.
        ...(body ? { serialize: (raw: any) => raw, body } : {}),
      })
      .then((payload) => {
        app.store.pushPayload(payload);
        this.attrs.onstored(this.storedValue());
      })
      .catch(() => {
        // O core já mostra o erro da API num alerta.
      })
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }
}
