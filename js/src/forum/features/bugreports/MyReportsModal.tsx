/*
 * "Meus relatórios": o que a pessoa enviou, com o status e a resposta da
 * equipe. A captura vem da API, que só a entrega para o dono ou o admin.
 */
import app from 'flarum/forum/app';
import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import humanTime from 'flarum/common/helpers/humanTime';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { apiUrl, KIND_ICONS, type Kind } from './ReportModal';

interface MyReport {
  id: number;
  kind: Kind;
  status: string;
  description: string;
  note: string | null;
  url: string;
  createdAt: string;
}

export default class MyReportsModal extends Modal<IInternalModalAttrs> {
  private reports: MyReport[] | null = null;

  oninit(vnode: Mithril.Vnode<IInternalModalAttrs, this>) {
    super.oninit(vnode);

    app
      .request<{ reports: MyReport[] }>({ method: 'GET', url: apiUrl('/canela-bug-reports'), params: { mine: 1 } })
      .then((payload) => (this.reports = payload.reports || []))
      .catch(() => (this.reports = []))
      .finally(() => m.redraw());
  }

  className() {
    return 'CanelaBugMine Modal--medium';
  }

  title() {
    return t('bug_reports.mine_title');
  }

  content() {
    if (!this.reports) return <div className="Modal-body">{<LoadingIndicator />}</div>;

    if (!this.reports.length) return <div className="Modal-body CanelaBugMine-empty">{t('bug_reports.mine_empty')}</div>;

    return (
      <div className="Modal-body">
        <ul className="CanelaBugMine-list">
          {this.reports.map((report) => (
            <li key={report.id} className="CanelaBugMine-item">
              <img className="CanelaBugMine-thumb" src={apiUrl(`/canela-bug-reports/${report.id}/region`)} alt="" loading="lazy" />
              <div className="CanelaBugMine-body">
                <div className="CanelaBugMine-meta">
                  <span className={`CanelaBugStatus CanelaBugStatus--${report.status}`}>{t(`bug_reports.status_${report.status}`)}</span>
                  <span className="CanelaBugMine-kind">
                    <i className={`icon ${KIND_ICONS[report.kind] || KIND_ICONS.bug}`} aria-hidden="true" /> {t(`bug_reports.kind_${report.kind}`)}
                  </span>
                  <span className="CanelaBugMine-date">{humanTime(new Date(report.createdAt))}</span>
                </div>
                <p className="CanelaBugMine-description">{report.description}</p>
                {report.note && (
                  <p className="CanelaBugMine-note">
                    <strong>{t('bug_reports.team_note')}</strong> {report.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }
}
