import Model from 'flarum/common/Model';
export type BadgeType = 'gold' | 'silver' | 'bronze';
/** Um emblema (`/api/canela-badges`). O nome e as descrições já vêm traduzidos pelo servidor. */
export default class Badge extends Model {
    slug(): string;
    name(): string;
    description(): string | null;
    /** Só vem na página do emblema (`GET /api/canela-badges/:id`). */
    longDescription(): string | null | undefined;
    /** Imagem no lugar do ícone (admin); só depois da migração do admin de emblemas. */
    imageUrl(): string | null | undefined;
    icon(): string;
    type(): BadgeType;
    grouping(): string;
    position(): number;
    multipleGrant(): boolean;
    system(): boolean;
    enabled(): boolean;
    listable(): boolean;
    /** Só para o admin: o fórum tem o que a regra precisa medir. */
    available(): boolean | undefined;
    grantCount(): number;
}
