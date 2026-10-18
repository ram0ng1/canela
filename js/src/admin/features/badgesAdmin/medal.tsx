import Icon from 'flarum/common/components/Icon';

/**
 * A medalha do emblema no admin (o mesmo markup do fórum): ícone ou imagem
 * dentro do círculo da cor do tipo.
 */
export function medal(badge: { type: string; icon: string; imageUrl?: string | null }, size: 'small' | 'large' = 'small') {
  const imageUrl = badge.imageUrl && /^https?:\/\//i.test(badge.imageUrl) ? badge.imageUrl : null;

  return (
    <span className={`CanelaBadgeMedal CanelaBadgeMedal--${badge.type} CanelaBadgeMedal--${size}${imageUrl ? ' CanelaBadgeMedal--image' : ''}`}>
      {imageUrl ? (
        <img className="CanelaBadgeMedal-image" src={imageUrl} alt="" loading="lazy" />
      ) : (
        <Icon name={badge.icon || 'fas fa-certificate'} className="CanelaBadgeMedal-icon" />
      )}
    </span>
  );
}
