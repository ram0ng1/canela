/*
 * "Editar marcador", o modal do Discourse (bookmark-reminder-modal): um nome
 * opcional, o "Lembre-me" com os atalhos de horário (mais tarde hoje, amanhã,
 * próxima semana, próximo mês, personalizado ou nenhum) e, no rodapé, Salvar,
 * Cancelar e Excluir.
 *
 * O mesmo modal cria (post ainda não marcado) e edita. Nada é gravado até o
 * Salvar: o Cancelar desfaz tudo, como lá.
 */
import app from 'flarum/forum/app';
import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import Stream from 'flarum/common/utils/Stream';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import { bookmarkRecord, createBookmark, deleteBookmark, postBookmark, updateBookmark } from '../actions';
import { availablePresets, fromLocalInputs, presetDate, presetHint, reminderLabel, toLocalInputs, type ReminderPreset } from '../reminders';

export interface BookmarkModalAttrs extends IFormModalAttrs {
  post: Post;
}

const PRESET_ICONS: Record<ReminderPreset, string> = {
  later_today: 'fas fa-moon',
  tomorrow: 'fas fa-sun',
  next_week: 'fas fa-briefcase',
  next_month: 'far fa-calendar-plus',
  custom: 'fas fa-calendar-alt',
  none: 'fas fa-ban',
};

/** O mesmo limite da coluna `name` no banco. */
const NAME_MAX_LENGTH = 100;

export default class BookmarkModal extends FormModal<BookmarkModalAttrs> {
  name!: Stream<string>;
  preset!: ReminderPreset | null;
  customDate!: Stream<string>;
  customTime!: Stream<string>;

  /** O lembrete que já existia: continua valendo se nenhum atalho for escolhido. */
  existingReminder: Date | null = null;

  oninit(vnode: Mithril.Vnode<BookmarkModalAttrs, this>) {
    super.oninit(vnode);

    const state = postBookmark(this.attrs.post);
    const reminder = state?.reminderAt && state.reminderAt.getTime() > Date.now() ? state.reminderAt : null;
    const custom = toLocalInputs(reminder ?? presetDate('tomorrow')!);

    this.name = Stream(state?.name ?? '');
    this.existingReminder = reminder;
    // Sem escolha ainda: salvar mantém o lembrete atual (ou nenhum).
    this.preset = null;
    this.customDate = Stream(custom.date);
    this.customTime = Stream(custom.time);
  }

  className() {
    return 'CanelaBookmarkModal Modal--small';
  }

  title() {
    return postBookmark(this.attrs.post) ? t('bookmarks.modal.edit_title') : t('bookmarks.modal.create_title');
  }

  content() {
    const isEditing = !!postBookmark(this.attrs.post);

    return (
      <div className="Modal-body">
        <div className="Form">
          <div className="Form-group">
            <label className="CanelaBookmarkModal-label" for="canela-bookmark-name">
              {t('bookmarks.modal.name_label')}
            </label>
            <input
              id="canela-bookmark-name"
              className="FormControl"
              name="name"
              type="text"
              maxlength={NAME_MAX_LENGTH}
              placeholder={t('bookmarks.modal.name_placeholder')}
              bidi={this.name}
            />
          </div>

          {this.existingReminder && this.preset === null && (
            <p className="CanelaBookmarkModal-existing">
              <Icon name="far fa-clock" />
              <span>{t('bookmarks.modal.existing_reminder', { date: reminderLabel(this.existingReminder) })}</span>
            </p>
          )}

          <fieldset className="Form-group CanelaBookmarkModal-reminder">
            <legend className="CanelaBookmarkModal-label">{t('bookmarks.modal.reminder_label')}</legend>
            <div className="CanelaBookmarkModal-presets" role="radiogroup">
              {[...availablePresets(), 'custom' as const, 'none' as const].map((preset) => this.presetButton(preset))}
            </div>

            {this.preset === 'custom' && (
              <div className="CanelaBookmarkModal-custom">
                <input className="FormControl" type="date" aria-label={t('bookmarks.modal.custom_date')} bidi={this.customDate} />
                <input className="FormControl" type="time" aria-label={t('bookmarks.modal.custom_time')} bidi={this.customTime} />
              </div>
            )}
          </fieldset>

          <div className="Form-group CanelaBookmarkModal-footer">
            <Button className="Button Button--primary" type="submit" loading={this.loading}>
              {t('bookmarks.modal.save')}
            </Button>
            <Button className="Button Button--flat" onclick={() => this.hide()}>
              {t('bookmarks.modal.cancel')}
            </Button>
            {isEditing && (
              <Button
                className="Button Button--flat CanelaBookmarkModal-delete"
                icon="far fa-trash-alt"
                onclick={() => this.remove()}
                disabled={this.loading}
              >
                {t('bookmarks.modal.delete')}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  presetButton(preset: ReminderPreset): Mithril.Children {
    const date = presetDate(preset);
    const selected = this.preset === preset;

    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected ? 'true' : 'false'}
        className={classList('CanelaBookmarkModal-preset', { 'is-selected': selected })}
        onclick={() => (this.preset = selected ? null : preset)}
      >
        <Icon name={PRESET_ICONS[preset]} className="CanelaBookmarkModal-presetIcon" />
        <span className="CanelaBookmarkModal-presetLabel">{t(`bookmarks.presets.${preset}`)}</span>
        {date && <span className="CanelaBookmarkModal-presetHint">{presetHint(date)}</span>}
      </button>
    );
  }

  /**
   * O lembrete a gravar: `undefined` mantém o atual, `null` tira, uma data
   * troca. `false` quando o horário personalizado é inválido.
   */
  chosenReminder(): Date | null | undefined | false {
    switch (this.preset) {
      case null:
        return undefined;
      case 'none':
        return null;
      case 'custom': {
        const date = fromLocalInputs(this.customDate(), this.customTime());

        return date && date.getTime() > Date.now() ? date : false;
      }
      default:
        return presetDate(this.preset);
    }
  }

  onsubmit(e: SubmitEvent): void {
    e.preventDefault();

    const reminderAt = this.chosenReminder();

    if (reminderAt === false) {
      this.alertAttrs = { type: 'error', content: t('bookmarks.modal.invalid_date') };
      m.redraw();
      return;
    }

    const post = this.attrs.post;
    const bookmark = bookmarkRecord(post);
    const changes = { name: this.name(), reminderAt };

    this.loading = true;
    this.alertAttrs = null;

    (bookmark ? updateBookmark(post, bookmark, changes) : createBookmark(post, changes))
      .then(() => this.hide())
      .catch(() => {
        // O erro da API já aparece no alerta global; o modal fica aberto
        // para tentar de novo.
        this.loading = false;
        m.redraw();
      });
  }

  remove(): void {
    const post = this.attrs.post;

    this.loading = true;

    deleteBookmark(post)
      .then(() => {
        app.alerts.show({ type: 'success' }, t('bookmarks.alerts.removed'));
        this.hide();
      })
      .catch(() => {
        this.loading = false;
        m.redraw();
      });
  }
}
