import type User from 'flarum/common/models/User';
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
export declare function profileEnabled(): boolean;
export declare function profileField(field: ProfileField): boolean;
/**
 * A capa interna do tema vale na tela. Com a forumaker/profile-cover ativa a
 * capa larga vem dela, e a interna fica só no banco: sem campo nas
 * Configurações nem limpeza na moderação.
 */
export declare function internalCoverEnabled(): boolean;
/**
 * O fundo do cartão (mini-perfil) do tema. Vale também com a
 * forumaker/profile-cover: ela só cuida da capa larga, e sem um fundo próprio
 * o cartão usa a miniatura da capa dela.
 */
export declare function cardBackgroundEnabled(): boolean;
/** Endereço de imagem de outro site na capa e no fundo do cartão (desligado por padrão: rastreia quem vê o perfil). */
export declare function externalImagesEnabled(): boolean;
/** O envio de arquivo dos campos de imagem do tema (a capa interna e o fundo do cartão). */
export declare function coverUploadEnabled(): boolean;
/**
 * Com o fof/user-bio ativo, a bio é a dele: o tema mostra e edita o campo
 * `bio` da extensão (no mesmo lugar, com os mesmos campos), e o componente
 * dela sai do cartão (integrations.tsx). Assim não há duas bios.
 */
export declare function fofBio(): boolean;
/** O campo da bio vale: o do tema ligado no admin, ou o fof/user-bio ativo. */
export declare function bioEnabled(): boolean;
/** O atributo que guarda a bio na API (o da extensão, quando ela está ativa). */
export declare function bioAttribute(): 'bio' | 'canelaBio';
export declare function bioMaxLength(): number;
/** Pode editar a bio deste usuário (a permissão do fof/user-bio, quando ativo). */
export declare function canEditBio(user: User): boolean;
/** O próprio usuário ou a moderação. O atributo pode faltar num usuário que veio junto de um post. */
export declare function canEditProfile(user: User): boolean;
export declare function canEditTitle(user: User): boolean;
export declare function userBio(user: User): string | null;
/**
 * HTML seguro da bio. Do tema: gerado e escapado no servidor (BioRenderer),
 * só p, br, a, strong, em e code. Do fof/user-bio: o `bioHtml` que o
 * formatador dele gera (com a formatação ligada), ou o texto escapado aqui.
 */
export declare function userBioHtml(user: User): string | null;
export declare function userLocation(user: User): string | null;
export declare function userWebsite(user: User): string | null;
/** "https://www.exemplo.com/blog/" → "exemplo.com/blog", para exibir. */
export declare function websiteLabel(url: string): string;
export declare function userTitle(user: User): string | null;
/**
 * O status ainda valendo. A API já esconde o vencido, mas a página pode ficar
 * aberta além do prazo — daí a checagem de novo aqui.
 */
export declare function userStatus(user: User): ProfileStatus | null;
/** A capa larga do perfil: a da forumaker (`cover`) quando ela manda, senão a interna. */
export declare function userCoverUrl(user: User): string | null;
/**
 * O fundo do cartão: o que a pessoa escolheu no tema. Com a forumaker, sem um
 * fundo próprio, é a capa dela, na miniatura (`cover_thumbnail`, que só
 * existe com as miniaturas ligadas lá).
 */
export declare function userCardBackgroundUrl(user: User): string | null;
/**
 * A posição vertical (0 a 100%) que a pessoa escolheu no editor da forumaker,
 * ou null com a capa interna, que fica sempre centrada.
 */
export declare function userCoverPosition(user: User): number | null;
/**
 * O valor de uma variável CSS de imagem: `url("…")`. A API recusa aspas,
 * parênteses e espaços nas URLs, mas o escape aqui não depende disso.
 */
export declare function cssImage(url: string): string;
/** "MM-DD" (ano escondido) ou "AAAA-MM-DD". */
export declare function userBirthday(user: User): ProfileBirthday | null;
export declare function isBirthdayToday(birthday: ProfileBirthday | null): boolean;
/** "3 de março" ou "3 de março de 1990", no idioma do fórum. */
export declare function formatBirthday(birthday: ProfileBirthday): string;
