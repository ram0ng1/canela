import app from 'flarum/admin/app';
import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Select from 'flarum/common/components/Select';
import Switch from 'flarum/common/components/Switch';
import type Mithril from 'mithril';

import { trans } from '../../util';
import { medal } from './medal';
import { GROUPINGS, KEY, TYPES, errorText, hasAdminColumns, saveBadge, type BadgeAttributes, type BadgeRow } from './api';

export interface BadgeEditModalAttrs extends IFormModalAttrs {
  /** Ausente: emblema novo. */
  badge?: BadgeRow | null;
  /** Se a migração do admin já rodou (imagem, título, concessão manual). */
  adminColumns: boolean;
  onsave: () => void;
}

type Draft = Required<Pick<BadgeAttributes, 'name' | 'icon' | 'type' | 'grouping' | 'enabled' | 'listable' | 'multipleGrant'>> & {
  description: string;
  longDescription: string;
  imageUrl: string;
  allowTitle: boolean;
  manualGrant: boolean;
};

/**
 * Criar ou editar um emblema — o formulário do /admin/badges do Discourse.
 *
 * Num emblema do sistema, o slug (que liga à regra automática) e as opções
 * da regra (concessão múltipla e manual) não se editam; o resto sim. Só os
 * campos alterados vão para o servidor: um nome do sistema que não foi mexido
 * continua seguindo a tradução de cada idioma.
 */
export default class BadgeEditModal extends FormModal<BadgeEditModalAttrs> {
  draft!: Draft;
  original!: Draft;
  error: string | null = null;

  oninit(vnode: Mithril.Vnode<BadgeEditModalAttrs, this>) {
    super.oninit(vnode);

    const a = this.attrs.badge?.attributes;

    this.original = {
      name: a?.name ?? '',
      description: a?.description ?? '',
      longDescription: a?.longDescription ?? '',
      icon: a?.icon ?? 'fas fa-certificate',
      imageUrl: a?.imageUrl ?? '',
      type: a?.type ?? 'bronze',
      grouping: a?.grouping ?? 'other',
      enabled: a?.enabled ?? true,
      listable: a?.listable ?? true,
      multipleGrant: a?.multipleGrant ?? false,
      allowTitle: a?.allowTitle ?? false,
      manualGrant: a?.manualGrant ?? true,
    };
    this.draft = { ...this.original };
  }

  className() {
    return 'CanelaBadgeEditModal Modal--medium';
  }

  title() {
    return this.attrs.badge ? trans(`${KEY}.edit_title`, 'Editar emblema') : trans(`${KEY}.new_title`, 'Novo emblema');
  }

  isSystem(): boolean {
    return !!this.attrs.badge?.attributes.automatic;
  }

  content() {
    const d = this.draft;
    const adminColumns = this.attrs.badge ? hasAdminColumns(this.attrs.badge) : this.attrs.adminColumns;
    const system = this.isSystem();
    const preview = medal({ type: d.type, icon: d.icon, imageUrl: d.imageUrl }, 'large');

    return (
      <div className="Modal-body">
        <div className="Form CanelaBadgeEdit">
          <div className="CanelaBadgeEdit-preview">
            {preview}
            <div>
              <strong>{d.name || trans(`${KEY}.name_placeholder`, 'Nome do emblema')}</strong>
              <span>{d.description}</span>
            </div>
          </div>

          {system && (
            <p className="CanelaAdmin-notice">
              {trans(`${KEY}.system_notice`, 'Emblema do sistema: a regra automática continua valendo depois de editar.')}
            </p>
          )}

          {this.text('name', trans(`${KEY}.field_name`, 'Nome'), { required: true, maxlength: 100 })}
          {this.text('description', trans(`${KEY}.field_description`, 'Descrição'), { maxlength: 500 })}
          {this.text('longDescription', trans(`${KEY}.field_long_description`, 'Descrição longa'), { maxlength: 2000, multiline: true })}

          <div className="CanelaBadgeEdit-row">
            {this.text('icon', trans(`${KEY}.field_icon`, 'Ícone (Font Awesome)'), {
              maxlength: 100,
              placeholder: 'fas fa-certificate',
              help: trans(`${KEY}.field_icon_help`, 'Estilo e nome, como "fas fa-star" ou "far fa-heart".'),
            })}
            {adminColumns &&
              this.text('imageUrl', trans(`${KEY}.field_image`, 'Imagem (URL)'), {
                maxlength: 500,
                placeholder: 'https://…',
                help: trans(`${KEY}.field_image_help`, 'Opcional: no lugar do ícone. Endereço http(s) de uma imagem quadrada.'),
              })}
          </div>

          <div className="CanelaBadgeEdit-row">
            <div className="Form-group">
              <label>{trans(`${KEY}.field_type`, 'Tipo')}</label>
              <Select
                options={Object.fromEntries(TYPES.map((type) => [type, trans(`${KEY}.type_${type}`, type)]))}
                value={d.type}
                onchange={(value: any) => (d.type = value)}
              />
            </div>
            <div className="Form-group">
              <label>{trans(`${KEY}.field_grouping`, 'Agrupamento')}</label>
              <Select
                options={Object.fromEntries(GROUPINGS.map((grouping) => [grouping, trans(`${KEY}.grouping_${grouping}`, grouping)]))}
                value={d.grouping}
                onchange={(value: any) => (d.grouping = value)}
              />
            </div>
          </div>

          {this.toggle(
            'enabled',
            trans(`${KEY}.field_enabled`, 'Ligado'),
            trans(`${KEY}.field_enabled_help`, 'Desligado, some do fórum, deixa de ser concedido e as concessões feitas ficam ocultas.')
          )}
          {this.toggle('listable', trans(`${KEY}.field_listable`, 'Aparece na página de emblemas'))}
          {adminColumns && this.toggle('allowTitle', trans(`${KEY}.field_allow_title`, 'Pode ser usado como título'))}
          {!system && this.toggle('multipleGrant', trans(`${KEY}.field_multiple`, 'Pode ser concedido várias vezes à mesma pessoa'))}
          {!system && adminColumns && this.toggle('manualGrant', trans(`${KEY}.field_manual`, 'Concedido manualmente pela administração'))}

          {this.error && <p className="CanelaAdmin-formError">{this.error}</p>}

          <div className="Form-group">
            <Button className="Button Button--primary" type="submit" loading={this.loading}>
              {this.attrs.badge ? trans(`${KEY}.save`, 'Salvar') : trans(`${KEY}.create`, 'Criar emblema')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  text(
    name: keyof Draft,
    label: string,
    options: { required?: boolean; maxlength?: number; multiline?: boolean; placeholder?: string; help?: string } = {}
  ) {
    const id = `CanelaBadgeEdit-${name}`;
    const value = String(this.draft[name] ?? '');
    const oninput = (event: InputEvent) => ((this.draft as any)[name] = (event.target as HTMLInputElement).value);

    return (
      <div className="Form-group">
        <label for={id}>{label}</label>
        {options.multiline ? (
          <textarea id={id} className="FormControl" rows={4} maxlength={options.maxlength} value={value} oninput={oninput} />
        ) : (
          <input
            id={id}
            className="FormControl"
            maxlength={options.maxlength}
            required={options.required}
            placeholder={options.placeholder}
            value={value}
            oninput={oninput}
          />
        )}
        {options.help && <p className="helpText">{options.help}</p>}
      </div>
    );
  }

  toggle(name: keyof Draft, label: string, help?: string) {
    return (
      <div className="Form-group">
        <Switch state={!!this.draft[name]} onchange={(value: boolean) => ((this.draft as any)[name] = value)}>
          {label}
        </Switch>
        {help && <p className="helpText">{help}</p>}
      </div>
    );
  }

  /** Só o que mudou (ou tudo, num emblema novo); textos vazios viram nulos. */
  changes(): Partial<BadgeAttributes> {
    const changes: Record<string, unknown> = {};

    (Object.keys(this.draft) as (keyof Draft)[]).forEach((key) => {
      if (this.attrs.badge && this.draft[key] === this.original[key]) return;

      const value = this.draft[key];
      // Nome e ícone vazios vão como estão, para o servidor recusar com a
      // mensagem certa; os opcionais vazios viram nulos.
      const optional = key !== 'name' && key !== 'icon';
      changes[key] = typeof value === 'string' ? (optional && value.trim() === '' ? null : value.trim()) : value;
    });

    const adminColumns = this.attrs.badge ? hasAdminColumns(this.attrs.badge) : this.attrs.adminColumns;

    if (!adminColumns) {
      delete changes.imageUrl;
      delete changes.allowTitle;
      delete changes.manualGrant;
    }

    if (this.isSystem()) {
      delete changes.multipleGrant;
      delete changes.manualGrant;
    }

    return changes as Partial<BadgeAttributes>;
  }

  onsubmit(e: SubmitEvent) {
    e.preventDefault();

    const changes = this.changes();

    if (!Object.keys(changes).length) {
      this.hide();
      return;
    }

    this.loading = true;
    this.error = null;

    saveBadge(this.attrs.badge?.id ?? null, changes)
      .then(() => {
        this.attrs.onsave();
        this.hide();
      })
      .catch((error) => (this.error = errorText(error)))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }
}

export function openBadgeEditor(badge: BadgeRow | null, adminColumns: boolean, onsave: () => void): void {
  app.modal.show(BadgeEditModal, { badge, adminColumns, onsave });
}
