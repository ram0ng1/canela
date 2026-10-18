/*
 * fof/polls no jeito do poll do Discourse: a contagem grande de votos na
 * coluna da direita ("0 / votos"), sempre visível, e as instruções da
 * extensão embaixo dela. A grade em si (opções | informações / botões) é CSS.
 */
import { extend } from 'flarum/common/extend';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { t } from '../utils/settings';
import { thirdParty } from './settings';

export default function installPolls(): void {
  extend('ext:fof/polls/forum/components/Poll/AbstractPoll', 'infoItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!thirdParty.polls()) return;

    const poll = this.attrs.poll;
    const count = Number(poll?.voteCount?.());

    // Sem permissão para ver a contagem, a extensão não a manda.
    if (!Number.isFinite(count) || this.state?.canSeeVoteCount === false) return;

    // A frase "N votos no total" da extensão vira o número grande.
    items.remove('total-vote-count');

    items.add(
      'canelaVotes',
      <span className="CanelaPollCount">
        <span className="CanelaPollCount-number">{count}</span>
        <span className="CanelaPollCount-label">{t('thirdparty.polls.votes', { count })}</span>
      </span>,
      1000
    );
  });

  // Como no Discourse, a porcentagem (e a barra, que depende dela no CSS) só
  // aparece depois de votar ou quando a enquete termina: antes disso, as
  // opções são só os círculos de escolher.
  extend('ext:fof/polls/forum/components/Poll/PollOption', 'textItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!thirdParty.polls()) return;

    const state = this.attrs.state;

    if (!state?.hasVoted?.() && !state?.poll?.hasEnded?.()) items.remove('percent');
  });
}
