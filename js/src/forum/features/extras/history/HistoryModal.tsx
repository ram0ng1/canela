/*
 * O modal "Histórico": uma revisão por vez, com ‹ › para andar
 * entre elas, quem editou e quando, e a comparação com a versão anterior —
 * no texto corrido (inline) ou lado a lado.
 *
 * Compara o texto-fonte (o markdown que foi digitado), que é o que o servidor
 * guarda: o HTML renderizado muda com extensões e configurações, e um diff
 * dele mostraria mudanças que ninguém fez.
 */
import app from 'flarum/forum/app';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import { fullDate } from '../../../utils/dates';
import { diffStats, diffWords, type DiffPart } from './diff';

export interface HistoryModalAttrs extends IInternalModalAttrs {
  post: Post;
}

export interface VersionUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Version {
  number: number;
  createdAt: string | null;
  user: VersionUser | null;
  content: string | null;
}

export interface VersionList {
  versions: Version[];
  contentHidden: boolean;
}

type ViewMode = 'inline' | 'side';

const MODE_KEY = 'canela.historyMode';

function storedMode(): ViewMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'side' ? 'side' : 'inline';
  } catch {
    return 'inline';
  }
}

export default class HistoryModal<A extends IInternalModalAttrs = HistoryModalAttrs> extends Modal<A> {
  versions: Version[] = [];
  contentHidden = false;
  /** A versão mostrada (índice em `versions`); a comparação é com a anterior. */
  index = 0;
  mode: ViewMode = storedMode();
  failed = false;

  oninit(vnode: Mithril.Vnode<A, this>) {
    super.oninit(vnode);

    this.loading = true;

    this.load()
      .then((list) => {
        this.versions = list.versions;
        this.contentHidden = list.contentHidden;
        // Abre na edição mais recente.
        this.index = Math.max(0, this.versions.length - 1);
      })
      .catch(() => {
        this.failed = true;
      })
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  /**
   * As versões da mais antiga para a mais nova. Separado do oninit para que
   * outro histórico (o das revisões da wiki) use o mesmo modal com os dados
   * dele.
   */
  load(): Promise<VersionList> {
    const apiUrl = String(app.forum.attribute('apiUrl') || '/api').replace(/\/+$/, '');
    const post = (this.attrs as unknown as HistoryModalAttrs).post;

    return app
      .request<{ data: VersionList }>({
        method: 'GET',
        url: `${apiUrl}/canela/posts/${post.id()}/revisions`,
      })
      .then((response) => response.data);
  }

  className(): string {
    return 'CanelaHistoryModal Modal--large';
  }

  title(): Mithril.Children {
    return t('extras.history.title');
  }

  content(): Mithril.Children {
    if (this.loading)
      return (
        <div className="Modal-body">
          <LoadingIndicator />
        </div>
      );

    if (this.failed || !this.versions.length) {
      return (
        <div className="Modal-body">
          <p className="CanelaHistory-empty">{t('extras.history.failed')}</p>
        </div>
      );
    }

    return (
      <div className="Modal-body CanelaHistory">
        {this.navigation()}
        {this.contentHidden ? <p className="CanelaHistory-empty">{t('extras.history.content_hidden')}</p> : this.comparison()}
      </div>
    );
  }

  navigation(): Mithril.Children {
    const last = this.versions.length - 1;
    const current = this.versions[this.index];
    const previous = this.index > 0 ? this.versions[this.index - 1] : null;
    const go = (index: number) => () => (this.index = Math.min(last, Math.max(0, index)));

    return (
      <div className="CanelaHistory-nav">
        <div className="CanelaHistory-pager" role="group" aria-label={t('extras.history.pager_label')}>
          <Button
            className="Button Button--icon"
            icon="fas fa-backward-fast"
            disabled={this.index === 0}
            aria-label={t('extras.history.first')}
            onclick={go(0)}
          />
          <Button
            className="Button Button--icon"
            icon="fas fa-chevron-left"
            disabled={this.index === 0}
            aria-label={t('extras.history.previous')}
            onclick={go(this.index - 1)}
          />
          <span className="CanelaHistory-position" aria-live="polite">
            {previous
              ? t('extras.history.position', { from: previous.number, to: current.number, total: this.versions.length })
              : t('extras.history.original', { total: this.versions.length })}
          </span>
          <Button
            className="Button Button--icon"
            icon="fas fa-chevron-right"
            disabled={this.index === last}
            aria-label={t('extras.history.next')}
            onclick={go(this.index + 1)}
          />
          <Button
            className="Button Button--icon"
            icon="fas fa-forward-fast"
            disabled={this.index === last}
            aria-label={t('extras.history.last')}
            onclick={go(last)}
          />
        </div>

        <div className="CanelaHistory-editor">
          {current.user?.avatarUrl ? (
            <img className="Avatar CanelaHistory-avatar" src={current.user.avatarUrl} alt="" loading="lazy" />
          ) : (
            <Icon name="fas fa-user-pen" />
          )}
          <span>
            {t(previous ? 'extras.history.edited_by' : 'extras.history.created_by', {
              name: current.user ? current.user.displayName : t('extras.history.deleted_user'),
              date: current.createdAt ? fullDate(new Date(current.createdAt)) : '',
            })}
          </span>
        </div>

        <div className="CanelaHistory-modes" role="radiogroup" aria-label={t('extras.history.mode_label')}>
          {(['inline', 'side'] as ViewMode[]).map((mode) => (
            <Button
              className={classList('Button CanelaHistory-mode', { active: this.mode === mode })}
              icon={mode === 'inline' ? 'fas fa-align-left' : 'fas fa-table-columns'}
              role="radio"
              aria-checked={this.mode === mode ? 'true' : 'false'}
              onclick={() => this.setMode(mode)}
            >
              {t(`extras.history.mode_${mode}`)}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  comparison(): Mithril.Children {
    const current = this.versions[this.index];
    const previous = this.index > 0 ? this.versions[this.index - 1] : null;

    // A versão original não tem com o que comparar: mostra o texto inteiro.
    if (!previous) {
      return <pre className="CanelaHistory-text">{current.content || ''}</pre>;
    }

    const parts = diffWords(previous.content || '', current.content || '');
    const stats = diffStats(parts);

    return (
      <div className="CanelaHistory-diff">
        <div className="CanelaHistory-stats">
          <span className="CanelaHistory-added">{t('extras.history.added', { count: stats.added })}</span>
          <span className="CanelaHistory-removed">{t('extras.history.removed', { count: stats.removed })}</span>
        </div>
        {this.mode === 'inline' ? (
          <pre className="CanelaHistory-text">{this.render(parts, ['equal', 'insert', 'delete'])}</pre>
        ) : (
          <div className="CanelaHistory-columns">
            <pre className="CanelaHistory-text CanelaHistory-text--before" aria-label={t('extras.history.before')}>
              {this.render(parts, ['equal', 'delete'])}
            </pre>
            <pre className="CanelaHistory-text CanelaHistory-text--after" aria-label={t('extras.history.after')}>
              {this.render(parts, ['equal', 'insert'])}
            </pre>
          </div>
        )}
      </div>
    );
  }

  /** Só as partes dos tipos pedidos; <ins>/<del> dão o sentido também ao leitor de tela. */
  render(parts: DiffPart[], kinds: DiffPart['kind'][]): Mithril.Children {
    return parts
      .filter((part) => kinds.includes(part.kind))
      .map((part) => {
        if (part.kind === 'insert') return <ins className="CanelaHistory-ins">{part.text}</ins>;
        if (part.kind === 'delete') return <del className="CanelaHistory-del">{part.text}</del>;

        return part.text;
      });
  }

  setMode(mode: ViewMode): void {
    this.mode = mode;

    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // Sem armazenamento, o modo vale só até fechar o modal.
    }
  }
}
