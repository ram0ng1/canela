/*
 * IA do Discourse (o plugin discourse-ai): bot de conversas, "Perguntar à IA"
 * na busca, resumo do tópico e resumos curtos na lista, ajudante ✨ no editor
 * e tópicos relacionados.
 *
 * Tudo é instalado sempre e confere o `canelaAi` do fórum na hora de
 * desenhar: no initializer o fórum ainda não carregou, e sem provedor
 * configurado o campo é null e nada de IA aparece.
 */
import { extend } from 'flarum/common/extend';

import TopicEnd from '../../topic/components/TopicEnd';
import installEntryPoints from './bot/entryPoints';
import installAskAi from './search';
import installSummary from './summary';
import { summaryState } from './summary/SummaryPanel';
import installHelper from './helper';
import RelatedTopics from './RelatedTopics';
import installTranslation from './translation';
import { aiFeature } from './state';
import { topicSettings } from '../../topic/ui';

export function installAi(): void {
  installEntryPoints();
  installAskAi();
  installSummary();
  installHelper();
  installRelated();
  installTranslation();

  // O painel do resumo é do tópico: sair dele fecha o painel.
  extend('flarum/forum/components/DiscussionPage', 'onremove', () => summaryState.hide());
}

/** Os relacionados entram no fim do tópico, antes dos sugeridos. */
function installRelated(): void {
  extend(TopicEnd.prototype as any, 'view', function (this: TopicEnd, vnode: any) {
    const children = (vnode as any)?.children;

    // Com os sugeridos ligados, os relacionados viram a aba "Relacionado(a)"
    // deles (topic/components/SuggestedTopics), como no Discourse.
    if (!aiFeature('related') || topicSettings.suggested() || !Array.isArray(children)) return;

    const discussion = this.attrs.discussion;
    const at = Math.min(1, children.length);

    // Num array próprio, com chave: refaz a busca ao ir de um tópico direto
    // para outro, e o Mithril não aceita irmãos com e sem chave.
    children.splice(at, 0, [m(RelatedTopics, { key: `related-${discussion.id()}`, discussion })]);
  });
}

export default installAi;
