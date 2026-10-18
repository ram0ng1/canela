/*
 * fof/upload: o aviso "Enviando…" do editor do Discourse (#file-uploading),
 * com a barra de progresso. A extensão não informa a porcentagem (a
 * requisição é uma só), então a barra é indeterminada; ela some quando o
 * envio termina ou falha. O botão na barra de ferramentas é do editor.
 */
import { extend } from 'flarum/common/extend';
import TextEditor from 'flarum/common/components/TextEditor';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { thirdParty } from './settings';

export default function installUpload(): void {
  extend(TextEditor.prototype, 'oncreate', function (this: any) {
    this.uploader?.on?.('uploading', (files: FileList | File[]) => {
      this.canelaUploadCount = files?.length || 1;
    });
  });

  extend(TextEditor.prototype, 'view', function (this: any, vdom: Mithril.Vnode<any, any>) {
    if (!thirdParty.uploadProgress() || !this.uploader?.uploading || !vdom || !Array.isArray(vdom.children)) return;

    const count = this.canelaUploadCount || 1;

    vdom.children.push(
      <div className="CanelaUploadProgress" role="status" aria-live="polite">
        <span className="CanelaUploadProgress-label">{t('thirdparty.upload.uploading', { count })}</span>
        <span className="CanelaUploadProgress-bar" aria-hidden="true">
          <span className="CanelaUploadProgress-fill" />
        </span>
      </div>
    );
  });
}
