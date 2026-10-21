/*
 * Onde o perfil estendido aparece fora das Configurações: no UserCard do
 * core (o hero do perfil), no nome dos posts, no avatar do cabeçalho e no
 * modal "Editar usuário" da moderação.
 *
 * Tudo entra por ItemLists com chaves `canela*` próprias, sem trocar os itens
 * de ninguém: o agente do perfil reescreve o `identity` do UserCard, e o
 * título e o status vêm logo abaixo dele, como itens separados.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserCard from 'flarum/forum/components/UserCard';
import CommentPost from 'flarum/forum/components/CommentPost';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import Stream from 'flarum/common/utils/Stream';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { thirdParty } from '../../thirdparty/settings';
import { registerUserIcon } from '../../utils/userIcons';
import { BirthdayFact, Bio, LocationFact, StatusEmoji, StatusLine, TitleLine, WebsiteFact, profileImageStyle } from './components';
import {
  bioAttribute,
  bioEnabled,
  bioMaxLength,
  canEditBio,
  fofBio,
  canEditProfile,
  canEditTitle,
  cardBackgroundEnabled,
  internalCoverEnabled,
  profileEnabled,
  profileField,
  userCardBackgroundUrl,
  userCoverUrl,
  userStatus,
  userTitle,
} from './data';

export function installUserCard() {
  // As imagens como variáveis CSS no próprio .UserCard: a capa do hero
  // (.CanelaUserHero-cover) herda `--canela-cover`, e o cartão em popover usa
  // `--canela-user-card-bg` como fundo.
  extend(UserCard.prototype, 'view', function (this: any, vnode: Mithril.Vnode<any, any>) {
    // A capa da forumaker (thirdparty/profileCover) vale mesmo com o perfil estendido desligado.
    if (!vnode?.attrs || (!profileEnabled() && !thirdParty.profileCover())) return;

    const user: User = this.attrs.user;
    const images = profileImageStyle(user);

    if (!Object.keys(images).length) return;

    // O core passa `false` como style quando o usuário não tem cor.
    const style = vnode.attrs.style && typeof vnode.attrs.style === 'object' ? vnode.attrs.style : {};
    vnode.attrs.style = { ...style, ...images };
    vnode.attrs.className = classList(vnode.attrs.className, {
      'CanelaProfile--hasCover': !!userCoverUrl(user),
      'CanelaProfile--hasCardBg': !!userCardBackgroundUrl(user),
    });
  });

  extend(UserCard.prototype, 'contentItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!profileEnabled()) return;

    const user: User = this.attrs.user;
    const status = StatusLine(user);
    const title = TitleLine(user);
    const bio = Bio(user);

    // Logo abaixo do nome (100), antes das insígnias (90). A bio vem depois do
    // local e do site (o `info`, 80).
    if (title) items.add('canelaTitle', title, 99);
    if (status) items.add('canelaStatus', status, 98);
    if (bio) items.add('canelaBio', bio, 75);
  });

  // Com o fof/user-bio, a bio dele aparece no lugar da do tema (data.ts):
  // o componente que ele põe no cartão sai, senão eram duas. Registrado no
  // mount, depois dos initializers, para rodar depois do extend dele.
  extend(app as any, 'mount', () => {
    extend(UserCard.prototype, 'infoItems', function (items: ItemList<Mithril.Children>) {
      if (fofBio() && items.has('bio')) items.remove('bio');
    });
  });

  extend(UserCard.prototype, 'infoItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!profileEnabled()) return;

    const user: User = this.attrs.user;
    const location = LocationFact(user);
    const website = WebsiteFact(user);
    const birthday = BirthdayFact(user);

    // Antes de "visto há" (100) e "entrou em" (90).
    if (location) items.add('canelaLocation', location, 120);
    if (website) items.add('canelaWebsite', website, 115);
    if (birthday) items.add('canelaBirthday', birthday, 110);
  });
}

export function installPostUser() {
  // O emoji do status logo depois do nome, depois dos outros ícones (o selo
  // de verificado vem antes dele): utils/userIcons.
  registerUserIcon(
    'canelaStatus',
    // Só no cabeçalho do post: no cartão e no perfil o status é a pílula
    // embaixo do nome, e ao lado do nome fica só o selo.
    (user, context) => (context === 'post' ? StatusEmoji(user, 'CanelaStatusEmoji--post') : null),
    -100
  );

  // O título do usuário ao lado do nome no cabeçalho do post. O post usa o
  // SubtreeRetainer, que já redesenha quando o autor muda (freshness do user).
  extend(CommentPost.prototype, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
    const user = this.attrs.post?.user?.();
    const title = user && userTitle(user);

    if (title) items.add('canelaUserTitle', <span className="CanelaPostUserTitle">{title}</span>, 94);
  });
}

export function installSessionStatus() {
  // O emoji em selo sobre o avatar do cabeçalho.
  extend(SessionDropdown.prototype, 'getButtonContent', function (this: any, children: Mithril.Children[]) {
    const user = app.session.user;
    const emoji = user && StatusEmoji(user, 'CanelaStatusEmoji--avatar');

    if (emoji && Array.isArray(children)) children.splice(1, 0, emoji);
  });
}

interface ModeratorDraft {
  title: Stream<string>;
  bio: Stream<string>;
  location: Stream<string>;
  website: Stream<string>;
  clearStatus: Stream<boolean>;
  clearImages: Stream<boolean>;
}

/**
 * A moderação edita o perfil dos outros pelo "Editar usuário" do core: os
 * textos e dois botões de limpeza (status e imagens), para o caso de abuso.
 * O próprio usuário usa as Configurações — o modal fica como está para ele.
 */
export function installEditUserModal() {
  const module = 'flarum/common/components/EditUserModal';

  const applies = (modal: any): boolean => {
    const user: User | undefined = modal.attrs?.user;

    return !!user && profileEnabled() && user !== app.session.user && canEditProfile(user);
  };

  extend(module as any, 'oninit', function (this: any) {
    if (!applies(this)) return;

    const user: User = this.attrs.user;
    const str = (attribute: string) => user.attribute<string | null>(attribute) || '';

    this.canelaProfile = {
      title: Stream(str('canelaTitle')),
      bio: Stream(str(bioAttribute())),
      location: Stream(str('canelaLocation')),
      website: Stream(str('canelaWebsite')),
      clearStatus: Stream(false),
      clearImages: Stream(false),
    } satisfies ModeratorDraft;
  });

  extend(module as any, 'fields', function (this: any, items: ItemList<Mithril.Children>) {
    const draft: ModeratorDraft | undefined = this.canelaProfile;

    if (!draft || !applies(this)) return;

    const user: User = this.attrs.user;
    const input = (stream: Stream<string>, label: string, max: number, type = 'text') => (
      <div className="Form-group">
        <label>{label}</label>
        <input className="FormControl" type={type} maxlength={max} bidi={stream} />
      </div>
    );

    if (profileField('title') && canEditTitle(user)) items.add('canelaTitle', input(draft.title, t('profile.settings.title_label'), 60), 35);

    if (bioEnabled() && canEditBio(user)) {
      items.add(
        'canelaBio',
        <div className="Form-group">
          <label>{t('profile.settings.bio_label')}</label>
          <textarea className="FormControl" rows={3} maxlength={bioMaxLength()} bidi={draft.bio} />
        </div>,
        34
      );
    }

    if (profileField('location')) items.add('canelaLocation', input(draft.location, t('profile.settings.location_label'), 100), 33);
    if (profileField('website')) items.add('canelaWebsite', input(draft.website, t('profile.settings.website_label'), 255, 'url'), 32);

    const checkbox = (stream: Stream<boolean>, label: string) => (
      <label className="checkbox">
        <input type="checkbox" checked={stream()} onchange={(event: Event) => stream((event.target as HTMLInputElement).checked)} />
        {label}
      </label>
    );

    const clears = [
      userStatus(user) ? checkbox(draft.clearStatus, t('profile.moderation.clear_status')) : null,
      // Com a forumaker a capa larga é dela (o "…" do perfil já traz o editor
      // dela); aqui só entram as imagens do tema: a capa interna e o fundo do cartão.
      (internalCoverEnabled() && userCoverUrl(user)) || (cardBackgroundEnabled() && user.attribute<string | null>('canelaCardBackgroundUrl'))
        ? checkbox(draft.clearImages, t('profile.moderation.clear_images'))
        : null,
    ].filter(Boolean);

    if (clears.length) items.add('canelaClear', <div className="Form-group">{clears}</div>, 31);
  });

  extend(module as any, 'data', function (this: any, data: Record<string, unknown>) {
    const draft: ModeratorDraft | undefined = this.canelaProfile;

    if (!draft || !applies(this)) return;

    const user: User = this.attrs.user;
    const changed = (stream: Stream<string>, attribute: string) => stream().trim() !== (user.attribute<string | null>(attribute) || '');
    const value = (stream: Stream<string>) => stream().trim() || null;

    if (profileField('title') && canEditTitle(user) && changed(draft.title, 'canelaTitle')) data.canelaTitle = value(draft.title);
    // O campo do fof/user-bio aceita só texto (vazio apaga), o do tema aceita null.
    if (bioEnabled() && canEditBio(user) && changed(draft.bio, bioAttribute())) {
      data[bioAttribute()] = fofBio() ? draft.bio().trim() : value(draft.bio);
    }
    if (profileField('location') && changed(draft.location, 'canelaLocation')) data.canelaLocation = value(draft.location);
    if (profileField('website') && changed(draft.website, 'canelaWebsite')) data.canelaWebsite = value(draft.website);

    if (profileField('status') && draft.clearStatus()) {
      data.canelaStatusEmoji = null;
      data.canelaStatusText = null;
      data.canelaStatusUntil = null;
    }

    if (draft.clearImages()) {
      if (internalCoverEnabled()) data.canelaCoverUrl = null;
      if (cardBackgroundEnabled()) data.canelaCardBackgroundUrl = null;
    }
  });
}
