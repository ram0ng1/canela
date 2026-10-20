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

import { forumBool, forumInt, isExtensionEnabled } from '../../utils/settings';
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
 * A capa interna do tema vale na tela. Com a forumaker/profile-cover ativa a
 * capa larga vem dela, e a interna fica só no banco: sem campo nas
 * Configurações nem limpeza na moderação.
 */
export function internalCoverEnabled(): boolean {
  return profileField('cover') && !thirdParty.profileCover();
}

/**
 * O fundo do cartão (mini-perfil) do tema. Vale também com a
 * forumaker/profile-cover: ela só cuida da capa larga, e sem um fundo próprio
 * o cartão usa a miniatura da capa dela.
 */
export function cardBackgroundEnabled(): boolean {
  return profileField('cover');
}

/** O envio de arquivo dos campos de imagem do tema (a capa interna e o fundo do cartão). */
export function coverUploadEnabled(): boolean {
  return cardBackgroundEnabled() && forumBool('canelaProfileCoverUpload', true);
}

/**
 * Com o fof/user-bio ativo, a bio é a dele: o tema mostra e edita o campo
 * `bio` da extensão (no mesmo lugar, com os mesmos campos), e o componente
 * dela sai do cartão (integrations.tsx). Assim não há duas bios.
 */
export function fofBio(): boolean {
  return isExtensionEnabled('fof-user-bio');
}

/** O campo da bio vale: o do tema ligado no admin, ou o fof/user-bio ativo. */
export function bioEnabled(): boolean {
  return fofBio() ? profileEnabled() : profileField('bio');
}

/** O atributo que guarda a bio na API (o da extensão, quando ela está ativa). */
export function bioAttribute(): 'bio' | 'canelaBio' {
  return fofBio() ? 'bio' : 'canelaBio';
}

export function bioMaxLength(): number {
  return fofBio() ? forumInt('fof-user-bio.maxLength', 200) || 200 : forumInt('canelaProfileBioMaxLength', 1000);
}

/** Pode editar a bio deste usuário (a permissão do fof/user-bio, quando ativo). */
export function canEditBio(user: User): boolean {
  if (!fofBio()) return canEditProfile(user);

  return !!user.attribute<boolean>('canEditBio');
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Texto puro em HTML seguro: escapado, com as quebras de linha. */
function plainToHtml(text: string): string {
  return text
    .replace(/[&<>"']/g, (char) => ESCAPES[char])
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
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
  if (!bioEnabled()) return null;

  return str(user, bioAttribute());
}

/**
 * HTML seguro da bio. Do tema: gerado e escapado no servidor (BioRenderer),
 * só p, br, a, strong, em e code. Do fof/user-bio: o `bioHtml` que o
 * formatador dele gera (com a formatação ligada), ou o texto escapado aqui.
 */
export function userBioHtml(user: User): string | null {
  if (!bioEnabled()) return null;

  if (!fofBio()) return str(user, 'canelaBioHtml');

  if (user.attribute('canViewBio') === false) return null;

  const html = str(user, 'bioHtml');
  if (html) return html;

  const text = str(user, 'bio');

  return text ? plainToHtml(text) : null;
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
 * O fundo do cartão: o que a pessoa escolheu no tema. Com a forumaker, sem um
 * fundo próprio, é a capa dela, na miniatura (`cover_thumbnail`, que só
 * existe com as miniaturas ligadas lá).
 */
export function userCardBackgroundUrl(user: User): string | null {
  const own = cardBackgroundEnabled() ? safeImageUrl(str(user, 'canelaCardBackgroundUrl')) : null;

  if (own || !thirdParty.profileCover()) return own;

  return safeImageUrl(str(user, 'cover_thumbnail') || str(user, 'cover'));
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
