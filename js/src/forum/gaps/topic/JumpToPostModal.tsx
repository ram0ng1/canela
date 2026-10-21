/*
 * "Pular para…" (tecla #): o número da postagem. O core não tem
 * a janela; a linha do tempo só deixa arrastar. (Não há opção por
 * data: a API do Flarum não acha um post pela data.)
 */
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import FormModal from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Stream from 'flarum/common/utils/Stream';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';

export interface JumpToPostModalAttrs extends IInternalModalAttrs {
  stream: any;
}

export default class JumpToPostModal extends FormModal<JumpToPostModalAttrs> {
  number = Stream('');

  className() {
    return 'CanelaJumpModal Modal--small';
  }

  title() {
    return t('gaps.jump.title');
  }

  content(): Mithril.Children {
    const count = this.attrs.stream?.count?.() || 0;

    return (
      <div className="Modal-body">
        <div className="Form-group CanelaJumpModal-number">
          <label for="canela-jump-number">{t('gaps.jump.post_label')}</label>
          <div className="CanelaJumpModal-row">
            <input
              id="canela-jump-number"
              className="FormControl"
              type="number"
              min="1"
              max={count || undefined}
              bidi={this.number}
              placeholder="#"
            />
            <span className="CanelaJumpModal-of">{t('gaps.jump.of', { count })}</span>
          </div>
        </div>
        <div className="Form-group">
          <Button className="Button Button--primary Button--block" type="submit">
            {t('gaps.jump.submit')}
          </Button>
        </div>
      </div>
    );
  }

  onsubmit(event: SubmitEvent) {
    event.preventDefault();

    const stream = this.attrs.stream;
    const number = parseInt(this.number(), 10);

    this.hide();

    if (number > 0) stream.goToNumber(number);
  }
}
