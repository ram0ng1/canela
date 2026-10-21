/*
 * "Compartilhar discussão": o endereço num campo com
 * o botão de copiar e, embaixo, os botões das redes (X, Facebook, e-mail… —
 * as que o admin escolher). No celular, com a folha de compartilhamento do
 * sistema disponível, vale ela.
 */
import app from 'flarum/forum/app';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { forumString } from '../settings';
import { t } from '../../utils/settings';
import { copyText } from '../utils/clipboard';
import { canInvite, openInviteModal } from '../backend/invites';

interface Network {
  icon: string;
  url: (link: string, title: string) => string;
}

/** As redes de compartilhamento, incluindo as que o Brasil usa. */
const NETWORKS: Record<string, Network> = {
  x: { icon: 'fab fa-x-twitter', url: (link, title) => `https://x.com/intent/tweet?url=${link}&text=${title}` },
  facebook: { icon: 'fab fa-facebook', url: (link) => `https://www.facebook.com/sharer.php?u=${link}` },
  linkedin: { icon: 'fab fa-linkedin', url: (link) => `https://www.linkedin.com/sharing/share-offsite/?url=${link}` },
  whatsapp: { icon: 'fab fa-whatsapp', url: (link, title) => `https://api.whatsapp.com/send?text=${title}%20${link}` },
  telegram: { icon: 'fab fa-telegram', url: (link, title) => `https://t.me/share/url?url=${link}&text=${title}` },
  reddit: { icon: 'fab fa-reddit', url: (link, title) => `https://www.reddit.com/submit?url=${link}&title=${title}` },
  email: { icon: 'fas fa-envelope', url: (link, title) => `mailto:?subject=${title}&body=${link}` },
};

const DEFAULT_NETWORKS = 'x,facebook,whatsapp,email';

function enabledNetworks(): string[] {
  const configured = forumString('canelaShareNetworks') || DEFAULT_NETWORKS;

  return configured
    .split(/[\s,|]+/)
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name in NETWORKS);
}

export interface ShareModalAttrs extends IInternalModalAttrs {
  discussion: Discussion;
  post?: Post | null;
}

export default class ShareModal extends Modal<ShareModalAttrs> {
  copied = false;

  className() {
    return 'CanelaShareModal Modal--small';
  }

  title() {
    const post = this.attrs.post;

    return post ? t('gaps.share.post_title', { number: post.number() }) : t('gaps.share.title');
  }

  link(): string {
    const { discussion, post } = this.attrs;
    const path = post ? app.route.post(post) : app.route.discussion(discussion);

    return (app.forum.attribute<string>('baseOrigin') || window.location.origin) + path;
  }

  content(): Mithril.Children {
    const link = this.link();
    const title = this.attrs.discussion.title();

    return (
      <div className="Modal-body">
        <p className="CanelaShareModal-instructions">{this.attrs.post ? t('gaps.share.post_instructions') : t('gaps.share.instructions')}</p>
        <div className="CanelaShareModal-link">
          <input
            className="FormControl"
            type="text"
            readonly
            value={link}
            aria-label={t('gaps.share.link_label')}
            onfocus={(event: FocusEvent) => (event.target as HTMLInputElement).select()}
          />
          <Button
            className="Button Button--primary CanelaShareModal-copy"
            icon={this.copied ? 'fas fa-check' : 'far fa-copy'}
            aria-label={t('gaps.share.copy')}
            title={t('gaps.share.copy')}
            onclick={() =>
              copyText(link).then((ok) => {
                this.copied = ok;
                m.redraw();
              })
            }
          />
        </div>
        {this.copied && (
          <p className="CanelaShareModal-copied" role="status">
            {t('gaps.share.copied')}
          </p>
        )}
        <div className="CanelaShareModal-networks">
          {enabledNetworks().map((name) => {
            const network = NETWORKS[name];
            const href = network.url(encodeURIComponent(link), encodeURIComponent(title));

            return (
              <a
                className={`Button Button--icon CanelaShareModal-network CanelaShareModal-network--${name}`}
                href={href}
                target={name === 'email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                title={t(`gaps.share.networks.${name}`)}
                aria-label={t(`gaps.share.networks.${name}`)}
              >
                <Icon name={network.icon} />
              </a>
            );
          })}
        </div>
        {/* O "Convite", para trazer alguém novo ao fórum. */}
        {!this.attrs.post && canInvite() && (
          <div className="CanelaShareModal-invite">
            <Button className="Button" icon="fas fa-user-plus" onclick={() => openInviteModal(true)}>
              {t('gaps.invites.share_button')}
            </Button>
          </div>
        )}
      </div>
    );
  }
}
