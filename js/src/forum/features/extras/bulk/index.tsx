/*
 * Seleção em massa (para quem modera): um botão na barra da
 * lista liga caixas de seleção em cada tópico e uma barra de ações acima da
 * lista — marcar como lido, fixar, trancar, alterar etiquetas, ocultar,
 * excluir.
 *
 * Tudo por ItemLists do core: o botão em `IndexPage.actionItems` (que a barra
 * de navegação do tema desenha à direita), a barra em `contentItems`, e a
 * caixa em `DiscussionListItem.contentItems`.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import Button from 'flarum/common/components/Button';
import Tooltip from 'flarum/common/components/Tooltip';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import { bulkActions } from './actions';
import { bulkAvailable, loadedDiscussions, selection } from './selection';

/** O MinimalDiscussionListItem (resultados do modal) herda do item; ali não há seleção. */
function isMinimal(item: DiscussionListItem): boolean {
  return String(item.elementAttrs().className || '').includes('MinimalDiscussionListItem');
}

function toggleButton(): Mithril.Children {
  const label = selection.active ? t('extras.bulk.toggle_off') : t('extras.bulk.toggle_on');

  return (
    <Tooltip text={label}>
      <Button
        className={classList('Button Button--icon CanelaBulk-toggle', { active: selection.active })}
        icon="fas fa-list-check"
        aria-label={label}
        aria-pressed={selection.active ? 'true' : 'false'}
        onclick={() => selection.setActive(!selection.active)}
      />
    </Tooltip>
  );
}

function bar(): Mithril.Children {
  const selected = selection.selected();
  const count = selected.length;
  const total = loadedDiscussions().length;
  const actions = bulkActions().filter((action) => selected.some((discussion) => action.applies(discussion as any)));

  return (
    <div className="CanelaBulkBar" role="toolbar" aria-label={t('extras.bulk.bar_label')}>
      <div className="CanelaBulkBar-status">
        <span className="CanelaBulkBar-count">{t('extras.bulk.selected', { count })}</span>
        {count < total ? (
          <Button className="Button Button--link CanelaBulkBar-link" onclick={() => selection.selectAll()}>
            {t('extras.bulk.select_all', { count: total })}
          </Button>
        ) : null}
        {count > 0 && (
          <Button className="Button Button--link CanelaBulkBar-link" onclick={() => selection.clear()}>
            {t('extras.bulk.clear')}
          </Button>
        )}
      </div>
      <div className="CanelaBulkBar-actions">
        {count === 0 && <span className="CanelaBulkBar-hint">{t('extras.bulk.hint')}</span>}
        {actions.map((action) => (
          <Button
            className={classList('Button CanelaBulkBar-action', { 'CanelaBulkBar-action--danger': action.danger })}
            icon={action.icon}
            onclick={() => action.run(selection.selected() as any)}
          >
            {action.label}
          </Button>
        ))}
        <Button
          className="Button Button--icon Button--link CanelaBulkBar-close"
          icon="fas fa-times"
          aria-label={t('extras.bulk.toggle_off')}
          onclick={() => selection.setActive(false)}
        />
      </div>
    </div>
  );
}

export default function installBulkSelect(): void {
  extend(IndexPage.prototype, 'oninit', function () {
    // Outra lista, outra seleção: marcar tópicos de uma tag e trocar de tag
    // não pode deixar a ação valendo para o que sumiu da tela.
    selection.setActive(false);
  });

  extend(IndexPage.prototype, 'actionItems', function (items: ItemList<Mithril.Children>) {
    if (!bulkAvailable()) return;

    items.add('canelaBulk', toggleButton(), 5);
  });

  extend(IndexPage.prototype, 'contentItems', function (items: ItemList<Mithril.Children>) {
    if (!selection.active || !bulkAvailable()) return;

    // Entre a barra de navegação (100) e a lista (90).
    items.add('canelaBulkBar', bar(), 95);
  });

  extend(DiscussionListItem.prototype, 'oninit', function (this: DiscussionListItem) {
    // O item só se redesenha quando o SubtreeRetainer vê mudança; a seleção
    // precisa entrar nessa conta, senão a caixa não reage ao clique.
    this.subtree.check(
      () => selection.active,
      () => selection.active && selection.has(this.attrs.discussion)
    );
  });

  extend(DiscussionListItem.prototype, 'contentItems', function (this: DiscussionListItem, items: ItemList<Mithril.Children>) {
    if (!selection.active || isMinimal(this)) return;

    const discussion = this.attrs.discussion;
    const checked = selection.has(discussion);

    items.add(
      'canelaBulkCheck',
      <label className="CanelaBulkCheck" onclick={(event: MouseEvent) => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={checked}
          aria-label={t('extras.bulk.select_one', { title: discussion.title() })}
          onclick={(event: MouseEvent) => {
            selection.toggle(discussion, event.shiftKey);

            // Com shift+clique o estado final vem do intervalo, não do clique:
            // a caixa clicada é acertada aqui, porque o item pode nem se
            // redesenhar (SubtreeRetainer) se o estado dele não mudou.
            (event.currentTarget as HTMLInputElement).checked = selection.has(discussion);
          }}
        />
      </label>,
      // Antes de tudo, inclusive do avatar do celular (100).
      110
    );
  });

  extend(DiscussionListItem.prototype, 'elementAttrs', function (this: DiscussionListItem, attrs: Record<string, any>) {
    if (selection.active && selection.has(this.attrs.discussion)) {
      attrs.className = classList(attrs.className, 'CanelaBulk-selected');
    }
  });
}

export { selection };
export const bulkHasSelection = (): boolean => selection.count() > 0 && !!app.session.user;
