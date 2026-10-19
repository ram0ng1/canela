/*
 * As linhas que brilham enquanto a lista de tópicos carrega (trocar de
 * categoria, de filtro ou de ordem), no lugar do spinner do core.
 *
 * Cada linha usa as mesmas classes da linha real (listItem.tsx): título,
 * badges, postadores, respostas, visualizações e atividade, no desktop em
 * colunas e no celular com o avatar de 48px e os números nos cantos. As
 * barras ficam dentro desses elementos (com a fonte e a altura de linha
 * deles) e caem onde o texto vai cair: nada pula quando a lista chega.
 */
import app from 'flarum/forum/app';
import type Mithril from 'mithril';

import { forumBool } from '../utils/settings';

const ROWS = 8;

/** Larguras que variam de linha para linha, para não parecer uma grade. */
const TITLES = [62, 44, 71, 38, 55, 66, 48, 59];
const BADGES = ['5em', '7em', '4.5em', '6em'];

function row(index: number, showViews: boolean): Mithril.Children {
  return (
    <li key={`canela-skeleton-${index}`} className="CanelaListSkeleton-item" aria-hidden="true">
      <div className="DiscussionListItem CanelaListSkeleton">
        <div className="DiscussionListItem-content">
          <div className="CanelaListItem-avatar">
            <span className="Avatar CanelaSkeleton" />
          </div>
          <div className="DiscussionListItem-main CanelaTopic">
            <h2 className="DiscussionListItem-title CanelaTopic-titleLine">
              <span className="CanelaSkeleton CanelaSkeleton--line" style={{ width: `${TITLES[index % TITLES.length]}%` }} />
            </h2>
            <div className="CanelaTopic-meta">
              <span className="CanelaSkeleton CanelaSkeleton--line" style={{ width: BADGES[index % BADGES.length] }} />
            </div>
          </div>
          {forumBool('canelaListPosters', true) && (
            <div className="CanelaCell CanelaCell--posters CanelaPosters">
              {index % 3 ? (
                <span className="CanelaPosters-avatar">
                  <span className="Avatar CanelaSkeleton" />
                </span>
              ) : null}
              <span className="CanelaPosters-avatar CanelaPosters-avatar--latest">
                <span className="Avatar CanelaSkeleton" />
              </span>
            </div>
          )}
          <div className="CanelaCell CanelaCell--replies">
            <span className="CanelaSkeleton CanelaSkeleton--word CanelaListSkeleton-number" />
          </div>
          {showViews && (
            <div className="CanelaCell CanelaCell--views">
              <span className="CanelaSkeleton CanelaSkeleton--word CanelaListSkeleton-number" />
            </div>
          )}
          <div className="CanelaCell CanelaCell--activity">
            <span className="CanelaActivity">
              <span className="CanelaSkeleton CanelaSkeleton--word CanelaListSkeleton-age" />
            </span>
          </div>
        </div>
        {/* A coluna do ⋮ das linhas reais (só para quem tem controles): o
            cabeçalho e as linhas reservam a mesma largura antes e depois. */}
        {app.session.user ? <div className="DiscussionListItem-controls" /> : null}
      </div>
    </li>
  );
}

export default function listSkeleton(showViews: boolean): Mithril.Children[] {
  return Array.from({ length: ROWS }, (_, index) => row(index, showViews));
}
