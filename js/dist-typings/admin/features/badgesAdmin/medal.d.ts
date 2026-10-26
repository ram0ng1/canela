/**
 * A medalha do emblema no admin (o mesmo markup do fórum): ícone ou imagem
 * dentro do círculo da cor do tipo.
 */
export declare function medal(badge: {
    type: string;
    icon: string;
    imageUrl?: string | null;
}, size?: 'small' | 'large'): JSX.Element;
