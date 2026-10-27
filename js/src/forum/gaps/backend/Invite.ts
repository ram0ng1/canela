/*
 * O convite no store (`canela-invites`), espelho do InviteResource do PHP.
 */
import Model from 'flarum/common/Model';

export default class Invite extends Model {
  code() {
    return Model.attribute<string>('code').call(this);
  }

  url() {
    return Model.attribute<string>('url').call(this);
  }

  maxRedemptions() {
    return Model.attribute<number>('maxRedemptions').call(this);
  }

  redemptionCount() {
    return Model.attribute<number>('redemptionCount').call(this);
  }

  expiresAt() {
    return Model.attribute<Date | null | undefined, string | null>('expiresAt', Model.transformDate).call(this);
  }

  createdAt() {
    return Model.attribute<Date | undefined, string>('createdAt', Model.transformDate).call(this);
  }

  /** Ainda vale: dentro da validade e com usos sobrando. */
  usable() {
    return Model.attribute<boolean>('usable').call(this);
  }
}
