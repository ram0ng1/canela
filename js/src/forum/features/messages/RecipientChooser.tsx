/*
 * O campo de destinatários do composer de mensagem do Discourse
 * (`.user-selector` com o `email-group-user-chooser`): na metade esquerda da
 * linha de cima, "Adicionar usuários(as) ou grupos  +"; clicado, abre colado
 * embaixo o corpo do select-kit com "Pesquisar…", as escolhas em pílulas com
 * avatar e ✕ e a lista com avatar, nome de usuário e nome.
 *
 * É o mesmo SelectKit do composer de tópico (o seletor de etiquetas): só as
 * linhas vêm da busca de usuários da API, que é assíncrona — o SelectKit pede
 * as linhas a cada desenho, e a resposta chega com um redraw.
 *
 * O flarum/messages só conversa a dois (`users` aceita um destinatário), então
 * escolher outra pessoa troca a escolhida. E não há grupos: as conversas dele
 * são só entre pessoas.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type User from 'flarum/common/models/User';
import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';

import SelectKit, { type SelectKitRow } from '../../composer/SelectKit';
import { t } from '../../utils/settings';
import { groupLabel, messageGroup, messageGroupModel } from './util';

export interface RecipientChooserAttrs extends ComponentAttrs {
  /** Um Stream do Flarum: chamado sem argumento lê, com argumento grava. */
  recipients: { (): User[]; (value: User[]): unknown };
  /** Quantos destinatários cabem (o flarum/messages aceita um). */
  max: number;
  /**
   * O grupo da equipe escolhido (um Stream com o id), quando ele pode ser
   * escolhido: "mensagem à equipe" cai na caixa do grupo.
   */
  group?: { (): number | null; (value: number | null): unknown };
  /** Escolher o grupo põe alguém da equipe como destinatário (o composer precisa de um). */
  groupContact?: boolean;
  /** O texto do cabeçalho vazio ("Adicionar usuários(as) ou grupos", "Selecionar…"). */
  placeholder?: string;
  className?: string;
}

const SEARCH_DELAY_MS = 250;
const RESULTS = 6;

export default class RecipientChooser extends Component<RecipientChooserAttrs> {
  query = '';
  results: User[] = [];
  loading = false;
  /** Quem da equipe recebe quando o destinatário é o grupo (fica escondido atrás do chip). */
  contact: User | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private requestId = 0;

  onremove(vnode: Mithril.VnodeDOM<RecipientChooserAttrs, this>) {
    super.onremove(vnode);

    clearTimeout(this.timer);
  }

  view(): Mithril.Children {
    const groupId = this.attrs.group ? this.attrs.group() : null;
    const group = groupId ? messageGroupModel() : null;
    // Com o grupo escolhido, o contato da equipe não aparece como pessoa.
    const contact = group && this.attrs.groupContact ? this.contact : null;
    const selected = this.attrs.recipients().filter((user: User) => user !== contact);
    const placeholder = this.attrs.placeholder || t('messages.composer.users_placeholder');
    const hasSelection = selected.length > 0 || !!group;

    const groupChip = (inHeader: boolean) =>
      group ? (
        <span className={inHeader ? 'CanelaRecipients-headerUser CanelaRecipients-headerGroup' : 'CanelaRecipients-chipLabel'}>
          <Icon name="fas fa-user-group" />
          <span>{groupLabel(group)}</span>
        </span>
      ) : null;

    return (
      <SelectKit
        className={classList(this.attrs.className || 'CanelaComposerFields-cell', 'CanelaRecipients', {
          'has-selection': hasSelection,
          // Sem nada digitado, o Discourse mostra só o "Pesquisar…".
          'CanelaRecipients--idle': !this.query.trim(),
        })}
        label={placeholder}
        caret="fas fa-plus"
        caretOpen="fas fa-plus"
        stayOpen={this.attrs.max > 1}
        // Fechado, os escolhidos em texto separado por vírgulas ("RGJ, ondrej,
        // joya +"); um só, com o avatar.
        header={
          hasSelection ? (
            <span className="CanelaComposerFields-value CanelaRecipients-value">
              {groupChip(true)}
              {selected.length === 1 && !group ? (
                <span className="CanelaRecipients-headerUser">
                  <Avatar user={selected[0]} title="" />
                  <span>{selected[0].username()}</span>
                </span>
              ) : (
                <span className="CanelaRecipients-headerNames">{selected.map((user: User) => user.username()).join(', ')}</span>
              )}
            </span>
          ) : (
            <span className="CanelaComposerFields-placeholder">{placeholder}</span>
          )
        }
        before={
          hasSelection ? (
            <div className="CanelaSelectKit-selected">
              {group ? (
                <button
                  type="button"
                  className="CanelaSelectKit-chip CanelaRecipients-chip"
                  title={t('messages.composer.remove_recipient', { username: groupLabel(group) })}
                  onmousedown={(e: MouseEvent) => e.preventDefault()}
                  onclick={() => this.removeGroup()}
                >
                  <Icon name="fas fa-xmark" />
                  {groupChip(false)}
                </button>
              ) : null}
              {selected.map((user) => (
                <button
                  type="button"
                  className="CanelaSelectKit-chip CanelaRecipients-chip"
                  title={t('messages.composer.remove_recipient', { username: user.username() })}
                  onmousedown={(e: MouseEvent) => e.preventDefault()}
                  onclick={() => this.remove(user)}
                >
                  <Icon name="fas fa-xmark" />
                  <span>{user.username()}</span>
                </button>
              ))}
            </div>
          ) : null
        }
        rows={(filter: string) => this.rows(filter)}
        onselect={(key: string) => this.choose(key)}
        emptyText={this.emptyText()}
      />
    );
  }

  emptyText(): string {
    if (this.loading) return t('messages.composer.searching');

    return this.query.trim() ? t('messages.composer.no_results') : t('messages.composer.type_to_search');
  }

  rows(filter: string): SelectKitRow[] {
    if (filter !== this.query) {
      this.search(filter);
      // As linhas são pedidas no meio do desenho: a classe do campo (que
      // depende da busca) só acompanha no próximo.
      requestAnimationFrame(() => m.redraw());
    }

    const selected = this.attrs.recipients();
    const me = app.session.user;
    const rows: SelectKitRow[] = [];

    // A equipe como destinatária (`--group-name-first`): aparece quando a
    // busca bate com o nome do grupo, como os grupos com mensagens do Discourse.
    const group = messageGroupModel();
    const needle = filter.trim().toLowerCase();

    if (this.attrs.group && group && needle && !this.attrs.group() && this.groupMatches(group, needle)) {
      rows.push({
        key: 'group',
        title: groupLabel(group),
        content: (
          <span className="CanelaRecipients-row CanelaRecipients-row--group">
            <Icon name="fas fa-user-group" />
            <span className="CanelaRecipients-identifier">{groupLabel(group)}</span>
          </span>
        ),
      });
    }

    return rows.concat(
      this.results
        // Contas para quem ninguém escreve (anonimizadas pelo flarum/gdpr) nem aparecem.
        .filter((user) => user !== me && !selected.includes(user) && user.attribute('canMessage') !== false)
        .slice(0, RESULTS)
        .map((user) => {
          const unavailable = this.unavailable(user);

          return {
            key: String(user.id()),
            title: unavailable || user.displayName(),
            content: (
              <span className={classList('CanelaRecipients-row', { 'is-unavailable': !!unavailable })}>
                <Avatar user={user} title="" />
                <span className="CanelaRecipients-identifier">
                  {user.displayName() !== user.username() ? `@${user.username()}` : user.username()}
                </span>
                {user.displayName() !== user.username() ? <span className="CanelaRecipients-name">{user.displayName()}</span> : null}
                {unavailable ? <span className="CanelaRecipients-unavailable">{unavailable}</span> : null}
              </span>
            ),
          };
        })
    );
  }

  groupMatches(group: Group, needle: string): boolean {
    const names = [group.namePlural(), group.nameSingular(), t('messages.composer.staff_keyword')].map((name) => String(name || '').toLowerCase());

    return names.some((name) => name.includes(needle) || needle.includes(name));
  }

  /** Escolher o grupo: guarda o id e, no composer, põe o contato da equipe. */
  chooseGroup(): void {
    const group = messageGroup();

    if (!group || !this.attrs.group) return;

    this.attrs.group(group.id);
    this.query = '';
    this.results = [];

    if (this.attrs.groupContact && group.contactUserId) {
      app.store
        .find<User>('users', String(group.contactUserId))
        .then((user) => {
          this.contact = user;
          const current = this.attrs.recipients().filter((item: User) => item !== user);
          this.attrs.recipients(this.attrs.max > 1 ? [user, ...current].slice(0, this.attrs.max) : [user]);
          m.redraw();
        })
        .catch(() => {});
    }
  }

  removeGroup(): void {
    this.attrs.group?.(null);

    if (this.attrs.groupContact && this.contact) {
      const contact = this.contact;
      this.attrs.recipients(this.attrs.recipients().filter((item: User) => item !== contact));
    }

    this.contact = null;
  }

  /** Quem não pode ser escolhido, e por quê: não conseguiria responder. */
  unavailable(user: User): string | null {
    const me = app.session.user;

    if (me?.attribute('canMessageUsersWithoutPermission') || user.attribute('canSendAnyMessage') !== false) return null;

    return app.translator.trans('flarum-messages.forum.recipient_selection_modal.cannot_reply_text', {}, true) as string;
  }

  search(query: string): void {
    this.query = query;
    clearTimeout(this.timer);

    const q = query.trim();
    const id = ++this.requestId;

    if (!q) {
      this.results = [];
      this.loading = false;
      return;
    }

    this.loading = true;

    this.timer = setTimeout(() => {
      app.store
        .find<User[]>('users', { filter: { q }, page: { limit: RESULTS + 2 } })
        .then((users) => {
          if (id === this.requestId) this.results = Array.from(users || []);
        })
        .catch(() => {
          if (id === this.requestId) this.results = [];
        })
        .finally(() => {
          if (id !== this.requestId) return;
          this.loading = false;
          m.redraw();
        });
    }, SEARCH_DELAY_MS);
  }

  choose(key: string): void {
    if (key === 'group') return this.chooseGroup();

    // Uma pessoa no lugar do grupo (o composer tem um destinatário só).
    if (this.attrs.groupContact && this.attrs.group?.() && this.attrs.max <= 1) this.attrs.group(null);

    const user = this.results.find((item) => String(item.id()) === key);

    if (!user || this.unavailable(user)) return;

    const selected = this.attrs.recipients();

    // Num destinatário só, escolher outro troca o escolhido.
    this.attrs.recipients(this.attrs.max > 1 ? [...selected, user].slice(0, this.attrs.max) : [user]);
    this.query = '';
    this.results = [];

    // Escolhido o destinatário, o Discourse leva o foco para o título.
    requestAnimationFrame(() => {
      const title = document.querySelector<HTMLInputElement>('.Composer .CanelaMessageTitle-input');
      (title || document.querySelector<HTMLTextAreaElement>('.Composer .TextEditor-editor'))?.focus();
    });
  }

  remove(user: User): void {
    this.attrs.recipients(this.attrs.recipients().filter((item: User) => item !== user));
  }
}
