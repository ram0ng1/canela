/*
 * As peças que mostram o perfil estendido. Todas devolvem `null` quando o
 * campo está vazio ou desligado, então dá para usá-las em qualquer lugar sem
 * checar antes — é o que o hero do perfil e o cartão do tópico devem fazer.
 */
import app from 'flarum/forum/app';
import Icon from 'flarum/common/components/Icon';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import {
  cssImage,
  formatBirthday,
  isBirthdayToday,
  userBioHtml,
  userBirthday,
  userCardBackgroundUrl,
  userCoverPosition,
  userCoverUrl,
  userLocation,
  userStatus,
  userTitle,
  userWebsite,
  websiteLabel,
  type ProfileStatus,
} from './data';

/** Emoji padrão de quem pôs só a frase. */
export const DEFAULT_STATUS_EMOJI = '💬';

/** "até 15:30" no mesmo dia, "até sex., 18 out." depois. */
export function statusUntilLabel(until: Date): string {
  const now = new Date();
  const sameDay = until.toDateString() === now.toDateString();
  const locale = app.data.locale || undefined;

  const when = sameDay
    ? until.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : until.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });

  return t('profile.status.until', { when });
}

/** Texto inteiro do status, para o title e o leitor de tela. */
export function statusLabel(status: ProfileStatus): string {
  return [status.text, status.until ? statusUntilLabel(status.until) : null].filter(Boolean).join(' · ') || t('profile.status.label');
}

/** O emoji do status ao lado do nome (posts, cabeçalho, cartão). */
export function StatusEmoji(user: User, className = ''): Mithril.Children {
  const status = userStatus(user);

  if (!status) return null;

  const label = statusLabel(status);

  return (
    <span className={`CanelaStatusEmoji ${className}`.trim()} title={label} aria-label={label} role="img">
      {status.emoji || DEFAULT_STATUS_EMOJI}
    </span>
  );
}

/** Linha do status no cartão: emoji, frase e até quando. */
export function StatusLine(user: User): Mithril.Children {
  const status = userStatus(user);

  if (!status) return null;

  return (
    <div className="CanelaProfileStatus">
      <span className="CanelaProfileStatus-emoji" aria-hidden="true">
        {status.emoji || DEFAULT_STATUS_EMOJI}
      </span>
      {status.text && <span className="CanelaProfileStatus-text">{status.text}</span>}
      {status.until && <span className="CanelaProfileStatus-until">{statusUntilLabel(status.until)}</span>}
    </div>
  );
}

export function TitleLine(user: User): Mithril.Children {
  const title = userTitle(user);

  return title ? <div className="CanelaProfileTitle">{title}</div> : null;
}

export function Bio(user: User): Mithril.Children {
  const html = userBioHtml(user);

  // m.trust é seguro aqui: o HTML vem do BioRenderer, que escapa tudo antes de
  // acrescentar as poucas tags permitidas.
  return html ? <div className="CanelaProfileBio">{m.trust(html)}</div> : null;
}

export function LocationFact(user: User): Mithril.Children {
  const location = userLocation(user);

  return location ? (
    <span className="CanelaProfileFact CanelaProfileFact--location">
      <Icon name="fas fa-location-dot" />
      <span>{location}</span>
    </span>
  ) : null;
}

export function WebsiteFact(user: User): Mithril.Children {
  const website = userWebsite(user);

  return website ? (
    <a className="CanelaProfileFact CanelaProfileFact--website" href={website} target="_blank" rel="ugc nofollow noopener">
      <Icon name="fas fa-link" />
      <span>{websiteLabel(website)}</span>
    </a>
  ) : null;
}

export function BirthdayFact(user: User): Mithril.Children {
  const birthday = userBirthday(user);

  if (!birthday) return null;

  const today = isBirthdayToday(birthday);

  return (
    <span className={`CanelaProfileFact CanelaProfileFact--birthday${today ? ' is-today' : ''}`}>
      <Icon name="fas fa-cake-candles" />
      <span>{today ? t('profile.birthday.today') : formatBirthday(birthday)}</span>
    </span>
  );
}

/**
 * Variáveis CSS das imagens, para pôr no `style` do elemento do perfil ou do
 * cartão. `--canela-cover` é a que o hero do perfil já lê como camada de cima
 * da capa; `--canela-user-cover` e `--canela-user-card-bg` ficam para quem
 * quiser usar só uma delas.
 */
export function profileImageStyle(user: User): Record<string, string> {
  const style: Record<string, string> = {};
  const cover = userCoverUrl(user);
  const card = userCardBackgroundUrl(user);

  if (cover) {
    style['--canela-cover'] = cssImage(cover);
    style['--canela-user-cover'] = cssImage(cover);
  }

  if (card) style['--canela-user-card-bg'] = cssImage(card);

  // A posição da forumaker vale para a capa e para o cartão (a miniatura é a
  // mesma imagem reduzida). As regras do LESS caem em `center` sem ela.
  const position = userCoverPosition(user);
  if (position !== null && (cover || card)) style['--canela-cover-position'] = `center ${position}%`;

  return style;
}

/**
 * Tudo junto, na ordem do cartão de usuário: status, título, bio
 * e a linha de local/site/aniversário. Para o cartão do tópico, que é um
 * componente próprio e não um UserCard.
 */
export function ProfileCardExtras(user: User): Mithril.Children {
  const facts = [LocationFact(user), WebsiteFact(user), BirthdayFact(user)].filter(Boolean);
  const parts = [StatusLine(user), TitleLine(user), Bio(user), facts.length ? <div className="CanelaProfileFacts">{facts}</div> : null].filter(
    Boolean
  );

  return parts.length ? <div className="CanelaProfileExtras">{parts}</div> : null;
}
