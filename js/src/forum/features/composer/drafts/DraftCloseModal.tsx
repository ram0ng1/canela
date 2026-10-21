/*
 * "O que deseja fazer com a sua postagem?" — a pergunta ao
 * fechar um composer com texto: descartar, guardar para depois ou continuar
 * escrevendo. Com rascunho no servidor, fechar não precisa mais significar
 * perder o texto, que era o que o confirm() do core perguntava.
 */
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';

import { t } from '../../../utils/settings';

export interface DraftCloseModalAttrs extends IInternalModalAttrs {
  ondiscard: () => void;
  onsave: () => void;
}

export default class DraftCloseModal extends Modal<DraftCloseModalAttrs> {
  className() {
    return 'Modal--small CanelaDraftCloseModal';
  }

  title() {
    return t('composer.drafts.close_title');
  }

  content() {
    return (
      <div className="Modal-body">
        <p className="helpText">{t('composer.drafts.close_text')}</p>
        <div className="CanelaDraftCloseModal-actions">
          <Button
            className="Button Button--danger"
            icon="far fa-trash-can"
            onclick={() => {
              this.hide();
              this.attrs.ondiscard();
            }}
          >
            {t('composer.drafts.discard')}
          </Button>
          <Button
            className="Button Button--primary"
            icon="far fa-floppy-disk"
            onclick={() => {
              this.hide();
              this.attrs.onsave();
            }}
          >
            {t('composer.drafts.save_for_later')}
          </Button>
          <Button className="Button" onclick={() => this.hide()}>
            {t('composer.drafts.keep_editing')}
          </Button>
        </div>
      </div>
    );
  }
}
