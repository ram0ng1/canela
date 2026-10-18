/*
 * Peças pequenas que várias telas da IA usam, com os nomes das do Discourse:
 * os três pontinhos que ondulam (AiIndicatorWave), o esqueleto de blocos que
 * aparecem e piscam enquanto o resumo é gerado (AiBlinkingAnimation) e os
 * detalhes do que o bot consultou ("Pesquisou por…").
 */
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';

/** "A IA está gerando conteúdo…" — os pontos sobem um depois do outro. */
export function indicatorWave(): Mithril.Children {
  return (
    <span className="CanelaAi-wave" aria-hidden="true">
      <span className="CanelaAi-waveDot">.</span>
      <span className="CanelaAi-waveDot">.</span>
      <span className="CanelaAi-waveDot">.</span>
    </span>
  );
}

const BLOCKS = 20;

/**
 * Os blocos cinza do esqueleto. As larguras e a ordem são as do CSS do
 * Discourse; o ritmo (um bloco a cada 250 ms, depois o piscar em sequência)
 * fica todo no CSS, pelo índice de cada bloco.
 */
export function blinkingAnimation(): Mithril.Children {
  return (
    <ul className="CanelaAi-blinking" aria-hidden="true">
      {Array.from({ length: BLOCKS }, (_, index) => (
        <li className="CanelaAi-blinkingItem" style={{ '--i': String(index) }} />
      ))}
    </ul>
  );
}

export interface ToolActivity {
  tool: string;
  query?: string;
  results?: { id: string; title: string; url: string }[];
  topic?: { id: string; title: string; url: string } | null;
}

/**
 * O que o bot consultou, num `<details>` fechado acima da resposta — o
 * `.ai-details` do Discourse: "Pesquisou por "x" — 5 resultados", que abre
 * com os links; "Leu o tópico X".
 */
export function toolDetails(activities: ToolActivity[]): Mithril.Children {
  if (!activities?.length) return null;

  return (
    <div className="CanelaAi-tools">
      {activities.map((activity) => {
        if (activity.tool === 'read_topic') {
          return (
            <div className="CanelaAi-details CanelaAi-details--read">
              <Icon name="fas fa-book-open" />{' '}
              {activity.topic ? (
                <span>
                  {t('ai.tools.read')} <Link href={activity.topic.url}>{activity.topic.title}</Link>
                </span>
              ) : (
                <span>{t('ai.tools.read_missing')}</span>
              )}
            </div>
          );
        }

        const results = activity.results || [];

        return (
          <details className="CanelaAi-details">
            <summary className="CanelaAi-detailsSummary">
              <Icon name="fas fa-caret-right" className="CanelaAi-detailsCaret CanelaAi-detailsCaret--collapsed" />
              <Icon name="fas fa-caret-down" className="CanelaAi-detailsCaret CanelaAi-detailsCaret--expanded" />
              <Icon name="fas fa-magnifying-glass" /> {t('ai.tools.searched', { query: activity.query || '', count: results.length })}
            </summary>
            {results.length > 0 && (
              <ul className="CanelaAi-detailsList">
                {results.map((result) => (
                  <li>
                    <Link href={result.url}>{result.title}</Link>
                  </li>
                ))}
              </ul>
            )}
          </details>
        );
      })}
    </div>
  );
}
