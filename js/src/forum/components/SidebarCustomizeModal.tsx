import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import Button from 'flarum/common/components/Button';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { categorySymbol, tagSymbol, primaryTags, secondaryTags, sortTags, allTags, type CanelaTag } from '../utils/tags';
import { getSidebarPicks, setSidebarPicks, type SidebarSectionName } from '../utils/sidebarPrefs';

export interface SidebarCustomizeModalAttrs extends IInternalModalAttrs {
  section: SidebarSectionName;
}

/**
 * "Editar a seção" do Discourse: uma lista com busca e caixas de seleção das
 * categorias (ou etiquetas) que aparecem na barra lateral.
 */
export default class SidebarCustomizeModal extends Modal<SidebarCustomizeModalAttrs> {
  selected = new Set<string>();
  filter = '';

  oninit(vnode: Mithril.Vnode<SidebarCustomizeModalAttrs, this>) {
    super.oninit(vnode);

    const picks = getSidebarPicks(this.attrs.section);
    const initial = picks ?? this.defaultTags().map((tag) => tag.id()!);

    this.selected = new Set(initial);
  }

  className() {
    return 'CanelaSidebarCustomize Modal--small';
  }

  title() {
    return t(this.attrs.section === 'categories' ? 'sidebar.customize_categories' : 'sidebar.customize_tags');
  }

  /** O que a seção mostra sem escolha: as primárias, ou as etiquetas mais usadas. */
  defaultTags(): CanelaTag[] {
    return this.attrs.section === 'categories' ? primaryTags() : secondaryTags();
  }

  candidates(): CanelaTag[] {
    const tags = this.attrs.section === 'categories' ? sortTags(allTags().filter((tag) => tag.position() !== null)) : secondaryTags();
    const query = this.filter.trim().toLowerCase();

    return query ? tags.filter((tag) => tag.name().toLowerCase().includes(query)) : tags;
  }

  content(): Mithril.Children {
    const candidates = this.candidates();

    return (
      <div className="Modal-body">
        <div className="Form-group">
          <input
            className="FormControl"
            type="search"
            placeholder={t('sidebar.customize_filter')}
            value={this.filter}
            oninput={(event: InputEvent) => (this.filter = (event.target as HTMLInputElement).value)}
          />
        </div>

        <ul className="CanelaSidebarCustomize-list">
          {candidates.map((tag) => {
            const id = tag.id()!;
            const checked = this.selected.has(id);

            return (
              <li className={classList({ 'CanelaSidebarCustomize-item--child': tag.isChild() })}>
                <label className="checkbox">
                  <input type="checkbox" checked={checked} onchange={() => this.toggle(id)} />
                  {this.attrs.section === 'categories' ? categorySymbol(tag) : tagSymbol(tag, '', 'fas fa-tag')}
                  <span>{tag.name()}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="CanelaSidebarCustomize-actions">
          <Button className="Button Button--primary" onclick={() => this.save()}>
            {t('sidebar.customize_save')}
          </Button>
          <Button className="Button Button--link" onclick={() => this.reset()}>
            {t('sidebar.customize_reset')}
          </Button>
        </div>
      </div>
    );
  }

  toggle(id: string) {
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }

  save() {
    setSidebarPicks(this.attrs.section, Array.from(this.selected));
    this.hide();
  }

  reset() {
    setSidebarPicks(this.attrs.section, null);
    this.hide();
  }
}
