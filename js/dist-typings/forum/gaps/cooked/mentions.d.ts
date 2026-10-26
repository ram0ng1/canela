import type User from 'flarum/common/models/User';
export declare function slugFrom(link: HTMLAnchorElement): string | null;
export declare function findUser(slug: string): Promise<User | null>;
export default function installMentionCards(): void;
