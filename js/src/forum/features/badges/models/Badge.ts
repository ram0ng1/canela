import Model from 'flarum/common/Model';

export type BadgeType = 'gold' | 'silver' | 'bronze';

/** Um emblema (`/api/canela-badges`). O nome e as descrições já vêm traduzidos pelo servidor. */
export default class Badge extends Model {
  slug() {
    return Model.attribute<string>('slug').call(this);
  }
  name() {
    return Model.attribute<string>('name').call(this);
  }
  description() {
    return Model.attribute<string | null>('description').call(this);
  }
  /** Só vem na página do emblema (`GET /api/canela-badges/:id`). */
  longDescription() {
    return Model.attribute<string | null | undefined>('longDescription').call(this);
  }
  /** Imagem no lugar do ícone (admin); só depois da migração do admin de emblemas. */
  imageUrl() {
    return Model.attribute<string | null | undefined>('imageUrl').call(this);
  }
  icon() {
    return Model.attribute<string>('icon').call(this);
  }
  type() {
    return Model.attribute<BadgeType>('type').call(this);
  }
  grouping() {
    return Model.attribute<string>('grouping').call(this);
  }
  position() {
    return Model.attribute<number>('position').call(this);
  }
  multipleGrant() {
    return Model.attribute<boolean>('multipleGrant').call(this);
  }
  /** Pode virar título no perfil de quem ganhou (só com a coluna do admin de emblemas). */
  allowTitle() {
    return Model.attribute<boolean | undefined>('allowTitle').call(this);
  }
  system() {
    return Model.attribute<boolean>('system').call(this);
  }
  enabled() {
    return Model.attribute<boolean>('enabled').call(this);
  }
  listable() {
    return Model.attribute<boolean>('listable').call(this);
  }
  /** Só para o admin: o fórum tem o que a regra precisa medir. */
  available() {
    return Model.attribute<boolean | undefined>('available').call(this);
  }
  grantCount() {
    return Model.attribute<number>('grantCount').call(this);
  }
}
