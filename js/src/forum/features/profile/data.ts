/*
 * Leitura dos campos do perfil estendido que a API expõe no usuário
 * (`canela*`), e das chaves do admin que os ligam.
 *
 * Estas funções são a interface pública do recurso para as outras áreas do
 * tema (o hero do perfil, o cartão de usuário do tópico): elas já respeitam o
 * que o admin desligou e o status vencido, então quem mostra não precisa
 * repetir essas regras.
 */
import app from 'flarum/forum/app';
import type User from 'flarum/common/models/User';

import { forumBool, forumInt } from '../../utils/settings';
import { thirdParty } from '../../thirdparty/settings';

export type ProfileField = 'bio' | 'location' | 'website' | 'title' | 'status' | 'cover' | 'birthday';

export interface ProfileStatus {
  emoji: string | null;
  text: string | null;
  until: Date | null;
}

export interface ProfileBirthday {
  month: number;
  day: number;
  year: number | null;
}

export function profileEnabled(): boolean {
  return forumBool('canelaProfileEnabled', true);
}

export function profileField(field: ProfileField): boolean {
  return profileEnabled() && forumBool(`canelaProfile${field.charAt(0).toUpperCase()}${field.slice(1)}`, true);
}

/**
 * As imagens internas do tema (capa e fundo do cartão) valem na tela. Com a
 * forumaker/profile-cover ativa a capa vem dela, e as internas ficam só no
 * banco: sem campo nas Configurações nem limpeza na moderação.
 */
export function internalCoverEnabled(): boolean {
  return profileField('cover') && !thirdParty.profileCover();
}

export function coverUploadEnabled(): boolean {
  return internalCoverEnabled() && forumBool('canelaProfileCoverUpload', true);
}

export function bioMaxLength(): number {
  return forumInt('canelaProfileBioMaxLength', 1000);
}

function str(user: User, attribute: string): string | null {
  const value = user.attribute<unknown>(attribute);

  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** O próprio usuário ou a moderação. O atributo pode faltar num usuário que veio junto de um post. */
export function canEditProfile(user: User): boolean {
  if (!profileEnabled() || !app.session.user) return false;

  const flag = user.attribute<boolean | undefined>('canelaCanEditProfile');
  if (typeof flag === 'boolean') return flag;

  return user === app.session.user || !!user.canEdit();
}

export function canEditTitle(user: User): boolean {
  if (!profileField('title') || !app.session.user) return false;

  const flag = user.attribute<boolean | undefined>('canelaCanEditTitle');
  if (typeof flag === 'boolean') return flag;

  return user === app.session.user ? forumBool('canelaProfileTitleSelf', true) : !!user.canEdit();
}

export function userBio(user: User): string | null {
  return profileField('bio') ? str(user, 'canelaBio') : null;
}

/** HTML gerado e escapado no servidor (BioRenderer): só p, br, a, strong, em e code. */
export function userBioHtml(user: User): string | null {
  return profileField('bio') ? str(user, 'canelaBioHtml') : null;
}

export function userLocation(user: User): string | null {
  return profileField('location') ? str(user, 'canelaLocation') : null;
}

export function userWebsite(user: User): string | null {
  const url = profileField('website') ? str(user, 'canelaWebsite') : null;

  // A API já valida, mas o href nunca recebe nada que não seja http(s).
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/** "https://www.exemplo.com/blog/" → "exemplo.com/blog", como o Discourse mostra. */
export function websiteLabel(url: string): string {
  return url
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/\/$/, '')
    .slice(0, 60);
}

export function userTitle(user: User): string | null {
  return profileField('title') ? str(user, 'canelaTitle') : null;
}

/**
 * O status ainda valendo. A API já esconde o vencido, mas a página pode ficar
 * aberta além do prazo — daí a checagem de novo aqui.
 */
export function userStatus(user: User): ProfileStatus | null {
  if (!profileField('status')) return null;

  const emoji = str(user, 'canelaStatusEmoji');
  const text = str(user, 'canelaStatusText');

  if (!emoji && !text) return null;

  const rawUntil = str(user, 'canelaStatusUntil');
  const until = rawUntil ? new Date(rawUntil) : null;

  if (until && !Number.isNaN(until.getTime()) && until.getTime() <= Date.now()) return null;

  return { emoji, text, until: until && !Number.isNaN(until.getTime()) ? until : null };
}

/** A capa larga do perfil: a da forumaker (`cover`) quando ela manda, senão a interna. */
export function userCoverUrl(user: User): string | null {
  if (thirdParty.profileCover()) return safeImageUrl(str(user, 'cover'));

  return profileField('cover') ? safeImageUrl(str(user, 'canelaCoverUrl')) : null;
}

/**
 * O fundo do cartão. Com a forumaker é a mesma capa, na miniatura dela
 * (`cover_thumbnail`, que só existe com as miniaturas ligadas lá).
 */
export function userCardBackgroundUrl(user: User): string | null {
  if (thirdParty.profileCover()) return safeImageUrl(str(user, 'cover_thumbnail') || str(user, 'cover'));

  return profileField('cover') ? safeImageUrl(str(user, 'canelaCardBackgroundUrl')) : null;
}

/**
 * A posição vertical (0 a 100%) que a pessoa escolheu no editor da forumaker,
 * ou null com a capa interna, que fica sempre centrada.
 */
export function userCoverPosition(user: User): number | null {
  if (!thirdParty.profileCover() || !str(user, 'cover')) return null;

  const value = Number(user.attribute<unknown>('cover_position') ?? 50);

  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
}

function safeImageUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/**
 * O valor de uma variável CSS de imagem: `url("…")`. A API recusa aspas,
 * parênteses e espaços nas URLs, mas o escape aqui não depende disso.
 */
export function cssImage(url: string): string {
  return `url("${url.replace(/["\\\n\r]/g, (char) => encodeURIComponent(char))}")`;
}

/** "MM-DD" (ano escondido) ou "AAAA-MM-DD". */
export function userBirthday(user: User): ProfileBirthday | null {
  if (!profileField('birthday')) return null;

  const raw = str(user, 'canelaBirthday');
  const match = raw && /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(raw);

  if (!match) return null;

  return { year: match[1] ? Number(match[1]) : null, month: Number(match[2]), day: Number(match[3]) };
}

export function isBirthdayToday(birthday: ProfileBirthday | null): boolean {
  if (!birthday) return false;

  const today = new Date();

  return today.getMonth() + 1 === birthday.month && today.getDate() === birthday.day;
}

/** "3 de março" ou "3 de março de 1990", no idioma do fórum. */
export function formatBirthday(birthday: ProfileBirthday): string {
  // Ano fixo bissexto quando escondido, para 29/02 existir.
  const date = new Date(birthday.year ?? 2000, birthday.month - 1, birthday.day);
  const options: Intl.DateTimeFormatOptions = birthday.year ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' };

  try {
    return date.toLocaleDateString(app.data.locale || undefined, options);
  } catch {
    return date.toLocaleDateString(undefined, options);
  }
}
