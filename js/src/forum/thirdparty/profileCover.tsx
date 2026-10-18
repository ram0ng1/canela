/*
 * forumaker/profile-cover no lugar da capa interna do tema.
 *
 * Com a extensão ativa (e a chave do admin ligada), quem desenha continua
 * sendo o tema: a faixa do perfil, o fundo do cartão do usuário e o popover
 * do core leem a capa por features/profile/data.ts, que passa a devolver a
 * `cover` (perfil) e a `cover_thumbnail` (cartão) dela, com a posição
 * vertical escolhida no editor. O fundo que a extensão pinta no .UserCard é
 * neutralizado em less/forum/thirdparty/ProfileCover.less.
 *
 * A edição é a da extensão: o CoverEditorModal, aberto pelo item "Capa" que
 * ela já põe no menu "…" do perfil e pelo campo abaixo, nas Configurações →
 * Perfil, no lugar dos campos de imagem do tema. As imagens internas ficam no
 * banco, só fora da tela.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import type User from 'flarum/common/models/User';

import { t } from '../utils/settings';
import { cssImage, userCardBackgroundUrl, userCoverPosition } from '../features/profile/data';
import { extModule } from './settings';

const EDITOR = 'forum/components/CoverEditorModal';

/** Quem pode trocar a capa desse usuário, pela permissão da extensão. */
export function canEditForumakerCover(user: User): boolean {
  return !!user.attribute<boolean>('canSetProfileCover');
}

/** O editor da extensão (enviar, posicionar, remover). Vem do registro, nunca de um import. */
export function openForumakerCoverEditor(user: User): void {
  const Modal = extModule('forumaker-profile-cover', EDITOR);

  if (Modal) app.modal.show(Modal, { user });
}

export interface ForumakerCoverFieldAttrs extends ComponentAttrs {
  user: User;
}

/**
 * O campo "Capa do perfil" das Configurações com a forumaker: a prévia na
 * posição escolhida e o botão que abre o editor dela. Lê o usuário do store a
 * cada desenho, então a prévia acompanha o que o modal salvar.
 */
export class ForumakerCoverField extends Component<ForumakerCoverFieldAttrs> {
  view() {
    const user = this.attrs.user;
    const preview = userCardBackgroundUrl(user);
    const position = userCoverPosition(user);

    return (
      <div className="Form-group CanelaProfileImage CanelaProfileImage--cover CanelaForumakerCover">
        <label>{t('profile.settings.cover_label')}</label>

        <div
          className={`CanelaProfileImage-preview${preview ? ' has-image' : ''}`}
          style={preview ? { backgroundImage: cssImage(preview), backgroundPosition: `center ${position ?? 50}%` } : undefined}
          aria-hidden="true"
        >
          {!preview && <span className="CanelaProfileImage-empty">{t('profile.settings.no_image')}</span>}
        </div>

        {canEditForumakerCover(user) && (
          <div className="CanelaProfileImage-controls">
            <Button className="Button" icon="fas fa-image" onclick={() => openForumakerCoverEditor(user)}>
              {t('profile.settings.cover_edit')}
            </Button>
          </div>
        )}

        <p className="helpText">{t('profile.settings.cover_forumaker_help')}</p>
      </div>
    );
  }
}
