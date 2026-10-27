import Model from 'flarum/common/Model';
export default class Invite extends Model {
    code(): string;
    url(): string;
    maxRedemptions(): number;
    redemptionCount(): number;
    expiresAt(): Date | null | undefined;
    createdAt(): Date | undefined;
    /** Ainda vale: dentro da validade e com usos sobrando. */
    usable(): boolean;
}
