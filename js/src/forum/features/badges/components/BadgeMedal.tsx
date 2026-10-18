import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';

import type Badge from '../models/Badge';
import { t } from '../../../utils/settings';

export interface BadgeMedalAttrs extends ComponentAttrs {
  className?: string;
  badge: Badge;
  size?: 'small' | 'medium' | 'large';
}

/**
 * O ícone do emblema dentro de uma medalha redonda na cor do tipo — ouro,
 * prata ou bronze —, como o `badge-icon` do Discourse. Um emblema com imagem
 * (definida no admin) mostra a imagem no lugar do ícone. O tipo também vai no
 * `title`, para não depender só da cor.
 */
export default class BadgeMedal extends Component<BadgeMedalAttrs> {
  view() {
    const { badge, size = 'medium', className } = this.attrs;
    const type = badge.type() || 'bronze';
    // Só http(s): o servidor já valida, e isto não deixa passar outro esquema.
    const imageUrl = badge.imageUrl();
    const image = imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : null;

    return (
      <span
        className={classList('CanelaBadgeMedal', `CanelaBadgeMedal--${type}`, `CanelaBadgeMedal--${size}`, className, {
          'CanelaBadgeMedal--image': image,
        })}
        title={t(`badges.types.${type}`)}
      >
        {image ? (
          <img className="CanelaBadgeMedal-image" src={image} alt="" loading="lazy" />
        ) : (
          <Icon name={badge.icon() || 'fas fa-certificate'} className="CanelaBadgeMedal-icon" />
        )}
      </span>
    );
  }
}
