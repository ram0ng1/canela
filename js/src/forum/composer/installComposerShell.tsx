/*
 * O composer do Flarum com a forma do composer do Discourse (o redesenho que o
 * meta.discourse.org usa, `uc-enable-composer-redesign`):
 *
 *   alça · "Iniciar Discussão" / "Tópico ▾" ............ «  ⤢  —  ✕
 *   categoria ▾                 | 🏷 etiquetas opcionais ▾
 *   Título
 *   texto                       | prévia
 *   B I H 🔗 " </> … 😀 ............ Descartar  [Criar tópico]
 *
 * O core continua dono do comportamento (abrir, redimensionar, minimizar,
 * tela cheia, enviar); aqui só se trocam os itens das ItemLists e as classes
 * — a disposição é do CSS (`less/forum/Composer.less`).
 *
 * Composer, DiscussionComposer, ReplyComposer e EditPostComposer vêm num pedaço
 * carregado sob demanda: são estendidos pelo nome do módulo.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import ComposerState from 'flarum/forum/states/ComposerState';
import TextEditor from 'flarum/common/components/TextEditor';
import Button from 'flarum/common/components/Button';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import ComposerActionTitle from './ComposerActionTitle';
import ComposerFields from './ComposerFields';
import { missingTagsMessage, normalizeTags, selectableTags, type RuleTag } from './tagRules';
import installModals from './installModals';
import installTagModal from './tagModal';
import installAlignComposer from './alignComposer';
import installToolbar, { addMoreAction, richMode, setPlaceholderProvider } from './installToolbar';
import { editorComposer } from '../features/composer/common';
import { draftableBody, draftsOn, saveCurrentDraft } from '../features/composer/drafts/fofDrafts';
import { previewToggle, splitPossible, splitPreviewVisible } from '../features/composer/installPreview';
import { isExtensionEnabled, t } from '../utils/settings';

const REPLY = 'flarum/forum/components/ReplyComposer';
const EDIT = 'flarum/forum/components/EditPostComposer';
const DISCUSSION = 'flarum/forum/components/DiscussionComposer';

/** As alturas iniciais do Discourse: resposta 255px, o resto 400px. */
function defaultHeight(): number {
  return app.composer.bodyMatches(REPLY) ? 255 : 400;
}

/** A pessoa já arrastou a alça: a altura dela vale para todos os composers. */
function hasStoredHeight(): boolean {
  try {
    return !!localStorage.getItem('composerHeight');
  } catch {
    return false;
  }
}

function kindClass(): string {
  if (app.composer.bodyMatches(REPLY)) return 'CanelaComposer--reply';
  if (app.composer.bodyMatches(EDIT)) return 'CanelaComposer--edit';
  if (app.composer.bodyMatches(DISCUSSION)) return 'CanelaComposer--newTopic';

  return 'CanelaComposer--other';
}

/** Põe o conteúdo numa chave (trocando o que houver) com a prioridade dada. */
function put(items: ItemList<Mithril.Children>, key: string, content: Mithril.Children, priority: number): void {
  if (items.has(key)) items.setContent(key, content).setPriority(key, priority);
  else items.add(key, content, priority);
}

function controlButton(icon: string, label: string, onclick: () => void, className = ''): Mithril.Children {
  return (
    <Button
      className={`Button Button--icon Button--link CanelaComposer-control ${className}`}
      icon={icon}
      title={label}
      aria-label={label}
      onclick={onclick}
    />
  );
}

/**
 * O ✕ do Discourse é "Salvar e fechar": com rascunhos, guarda o texto e fecha
 * sem perguntar. Sem rascunhos, fecha como o core (que pergunta se há texto).
 */
function saveAndClose(): void {
  if (draftsOn() && draftableBody()) {
    saveCurrentDraft();
    app.composer.hide();
  } else {
    app.composer.close();
  }
}

/**
 * O placeholder do Discourse, que muda com o modo: no "A", "Digite aqui. Use
 * a barra de ferramentas ou Markdown para formatar."; no Markdown, "Digite
 * aqui. Use Markdown, BBCode, ou HTML para formatar." — aqui só com os
 * formatos ligados neste fórum. "Arraste ou cole imagens." só com o
 * fof/upload, que é quem recebe o arrastar e o colar.
 */
function bodyPlaceholder(rich: boolean = richMode()): string {
  const formats = [isExtensionEnabled('flarum-markdown') && 'Markdown', isExtensionEnabled('flarum-bbcode') && 'BBCode'].filter(Boolean) as string[];
  const upload = isExtensionEnabled('fof-upload') && !!app.forum.attribute('fof-upload.canUpload');
  const or = ` ${t('composer.shell.or')} `;

  let text: string;

  if (rich && formats.includes('Markdown')) text = t('composer.shell.body_placeholder_markdown');
  else if (formats.length) text = t('composer.shell.body_placeholder_formats', { formats: formats.join(or) });
  else text = t('composer.shell.body_placeholder');

  return upload ? `${text} ${t('composer.shell.drag_images')}` : text;
}

/**
 * Os rótulos do Discourse ("Iniciar Discussão", "Responder", "Salvar edição") e os
 * placeholders, só quando quem abriu o composer não passou os seus.
 */
function installLabels(): void {
  const labels: Array<[string, string]> = [
    ['forum/components/DiscussionComposer', 'composer.shell.submit_new_topic'],
    ['forum/components/ReplyComposer', 'composer.shell.submit_reply'],
    ['forum/components/EditPostComposer', 'composer.shell.submit_edit'],
  ];

  labels.forEach(([id, submitKey]) => {
    flarum.reg.onLoad('core', id, (module: any) => {
      override(module, 'initAttrs', function (this: any, original: (attrs: any) => void, attrs: any) {
        attrs.submitLabel = attrs.submitLabel || t(submitKey);
        attrs.placeholder = attrs.placeholder || bodyPlaceholder();
        if (id.endsWith('DiscussionComposer')) attrs.titlePlaceholder = attrs.titlePlaceholder || t('composer.shell.title_placeholder');

        return original(attrs);
      });
    });
  });
}

function installHeights(): void {
  override(ComposerState.prototype, 'minimumHeight', () => 255);

  // O Composer pega a altura padrão uma vez, ao montar; os composers abertos
  // depois herdam a do anterior. O Discourse decide a cada abertura.
  override(ComposerState.prototype, 'load', async function (this: ComposerState, original: (...args: any[]) => Promise<any>, ...args: any[]) {
    const result = await original(...args);

    if (!hasStoredHeight() && this.body?.componentClass) this.height = defaultHeight();

    return result;
  });

  override('flarum/forum/components/Composer' as any, 'defaultHeight', () => defaultHeight());
}

function installRoot(): void {
  // As classes de que o CSS precisa: o tipo do composer e se a prévia está
  // ao lado (`show-preview` / `hide-preview`, que mudam a largura).
  extend('flarum/forum/components/Composer' as any, 'view', function (vdom: any) {
    if (!vdom?.attrs) return;

    const rich = richMode();

    vdom.attrs.className = `${vdom.attrs.className} CanelaComposer ${kindClass()} ${splitPreviewVisible() && !rich ? 'show-preview' : 'hide-preview'}${rich ? ' is-rich' : ' is-markdown'}`;
  });

  // «, tela cheia, minimizar e ✕ — a ordem e os ícones do Discourse. Minimizado,
  // só o ✕, sobre a barra colorida.
  extend('flarum/forum/components/Composer' as any, 'controlItems', function (items: ItemList<Mithril.Children>) {
    const state = app.composer;
    const phone = app.screen() === 'phone';
    const closeLabel =
      draftsOn() && draftableBody()
        ? t('composer.shell.save_and_close')
        : (app.translator.trans('core.forum.composer.close_tooltip', {}, true) as string);

    if (state.position === 'minimized') {
      put(items, 'close', controlButton('fas fa-xmark', closeLabel, saveAndClose), 10);
      return;
    }

    // Os ícones do canto do Discourse: tela cheia, minimizar e fechar — e, no
    // modo Markdown, o « da prévia antes deles. O que outras extensões ponham
    // aqui sai.
    Object.keys(items.toObject()).forEach((key) => {
      if (!['fullScreen', 'minimize', 'close'].includes(key)) items.remove(key);
    });

    if (splitPossible()) put(items, 'canelaPreview', previewToggle(), 40);

    if (!phone) {
      put(
        items,
        'fullScreen',
        state.position === 'fullScreen'
          ? controlButton('fas fa-compress', app.translator.trans('core.forum.composer.exit_full_screen_tooltip', {}, true) as string, () =>
              state.exitFullScreen()
            )
          : controlButton('fas fa-expand', app.translator.trans('core.forum.composer.full_screen_tooltip', {}, true) as string, () =>
              state.fullScreen()
            ),
        30
      );
    }

    // Sem o `App-backControl` do core, que no celular vira o "voltar" do
    // cabeçalho: o composer móvel do Discourse mostra — e ✕ na própria linha.
    put(
      items,
      'minimize',
      controlButton('fas fa-minus', app.translator.trans('core.forum.composer.minimize_tooltip', {}, true) as string, () => state.minimize()),
      20
    );

    put(items, 'close', controlButton('fas fa-xmark', closeLabel, saveAndClose), 10);
  });
}

/**
 * O cabeçalho. Entra no primeiro corpo de composer, depois de todas as
 * extensões: assim os itens que elas põem (as tags, a enquete do fof/polls)
 * já estão na lista quando são trocados.
 */
function installHeader(): void {
  // A enquete do fof/polls: o botão "Adicionar enquete" do cabeçalho vira um
  // item do menu ⊕ da barra, como o "Criar enquete" do Discourse.
  addMoreAction(() => {
    const poll = (app.composer as any).canelaPoll;

    if (!poll || !app.composer.isVisible()) return null;

    return {
      key: 'poll',
      icon: 'fas fa-square-poll-horizontal',
      label: poll.hasPoll ? t('composer.shell.edit_poll') : t('composer.shell.add_poll'),
      active: poll.hasPoll,
      onclick: poll.onclick,
    };
  });

  const takePoll = (body: any, items: ItemList<Mithril.Children>) => {
    const poll: any = items.has('polls') ? items.get('polls') : null;

    (app.composer as any).canelaPoll = poll?.attrs?.onclick ? { onclick: poll.attrs.onclick, hasPoll: !!body.composer?.fields?.poll } : null;
    if (poll) items.remove('polls');
  };

  let applied = false;

  extend('flarum/forum/components/ComposerBody' as any, 'oninit', function () {
    if (applied) return;
    applied = true;

    extend(DISCUSSION as any, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
      put(items, 'title', <ComposerActionTitle kind="new_topic" title={this.title} />, 1000);

      // O botão do flarum/tags vira a linha "categoria | etiquetas".
      if (items.has('tags')) {
        const original: any = items.get('tags');
        const disabled = String(original?.attrs?.className || '').includes('disabled') || !!this.attrs.disabled;

        // As tags que chegam de fora (a página da tag, um rascunho, o tópico
        // vinculado) passam pelas regras do flarum/tags: sem filha órfã e sem
        // tag em que o ator não pode iniciar discussão.
        const current: RuleTag[] = this.composer.fields.tags || [];
        const allowed = normalizeTags(current.filter((tag) => tag?.canStartDiscussion?.() !== false));
        if (allowed.length !== current.length) this.composer.fields.tags = allowed;

        put(
          items,
          'tags',
          <ComposerFields
            tags={allowed}
            disabled={disabled}
            onchange={(tags: any[]) => {
              this.composer.fields.tags = tags;
            }}
          />,
          500
        );
      }

      takePoll(this, items);
    });

    extend(REPLY as any, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
      put(items, 'title', <ComposerActionTitle kind="reply" discussion={this.attrs.discussion} />, 1000);
      takePoll(this, items);
    });

    extend(EDIT as any, 'headerItems', function (this: any, items: ItemList<Mithril.Children>) {
      put(items, 'title', <ComposerActionTitle kind="edit" post={this.attrs.post} />, 1000);
      takePoll(this, items);
    });
  });
}

/**
 * Os mínimos de tags do flarum/tags (`minPrimaryTags`, `minSecondaryTags`)
 * cobrados ao publicar, com a mensagem do próprio flarum/tags, e o seletor
 * que falta preencher aberto. Sem isso o flarum/tags abriria o modal dele,
 * que o tema substitui pela linha do composer. Fica por fora do override do
 * flarum/tags (que inicializa antes): só chega a ele uma seleção válida.
 */
function installTagRequirements(): void {
  override(DISCUSSION as any, 'onsubmit', function (this: any, original: (...args: unknown[]) => unknown, ...args: unknown[]) {
    if (!isExtensionEnabled('flarum-tags')) return original(...args);

    const tags = normalizeTags((this.composer.fields.tags || []) as RuleTag[]);
    this.composer.fields.tags = tags;

    const missing = selectableTags().length ? missingTagsMessage(tags) : null;
    if (!missing) return original(...args);

    app.alerts.show({ type: 'error' }, missing.message);

    const cell = missing.kind === 'primary' ? 'category' : 'tags';
    const chooser = document.querySelector(`.CanelaComposerFields-${cell}:not(.is-expanded) .CanelaSelectKit-header`) as HTMLElement | null;
    chooser?.click();

    return undefined;
  });
}

function installFooter(): void {
  // O rodapé do Discourse: a barra de formatação à esquerda e, à direita,
  // "Descartar" e o botão primário sem ícone.
  extend(TextEditor.prototype, 'controlItems', function (this: TextEditor, items: ItemList<Mithril.Children>) {
    if (!editorComposer(this) || editorComposer(this) !== app.composer) return;

    const attrs = this.attrs as any;

    // O "olho" de prévia do core: o tema já mostra a prévia lado a lado.
    if (items.has('preview')) items.remove('preview');

    if (items.has('submit')) {
      items.setContent(
        'submit',
        // Sem o `App-primaryControl` do core: no celular essa classe leva o
        // botão para o cabeçalho e esconde o rótulo; no Discourse ele fica no
        // rodapé, em texto.
        <Button className="Button Button--primary CanelaComposer-submit" onclick={() => (this as any).onsubmit()}>
          {attrs.submitLabel}
        </Button>
      );
    }

    const editing = app.composer.bodyMatches(EDIT);

    items.add(
      'canelaCancel',
      <Button className="Button Button--link CanelaComposer-cancel" onclick={() => app.composer.close()}>
        {editing ? t('composer.shell.cancel_edit') : t('composer.shell.discard')}
      </Button>,
      -200
    );

    // Onde cabe a prévia ao lado (mesmo escondida pelo «), o "olho" do core
    // — que leva à prévia dentro do tópico — sobra: o Discourse não tem.
    if (splitPossible() && items.has('preview')) items.remove('preview');
  });
}

export default function installComposerShell() {
  setPlaceholderProvider(bodyPlaceholder);
  installLabels();
  installHeights();
  installRoot();
  installHeader();
  installTagRequirements();
  installFooter();
  installToolbar();
  // Os modais de entrar/cadastrar (a casca de UI mora junto da do composer).
  installModals();
  // O modal de tags do flarum/tags no desenho do seletor de tags do composer.
  installTagModal();
  installAlignComposer();
}
