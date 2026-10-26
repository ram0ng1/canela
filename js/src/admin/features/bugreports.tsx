/*
 * Card do "Relatar problema", na aba própria do painel: a chave do recurso, as
 * opções do botão e o painel com os relatórios (./bugReportsAdmin).
 * Baseado no Bugframe (github.com/vmatheus3/bug-frame, MIT).
 */
import { AdminNotice, SubTitle } from '../components/AdminCard';
import AdminToggle from '../components/AdminToggle';
import { trans } from '../util';
import type { CardDef } from '../types';
import ReportManager, { KEY } from './bugReportsAdmin/ReportManager';

const toggle = (name: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`)} help={trans(`${KEY}.${name}_help`)} />
);

const cards: CardDef[] = [
  {
    id: 'bug-reports',
    group: 'bugreports',
    icon: 'fas fa-bug',
    title: () => trans(`${KEY}.title`),
    description: () => trans(`${KEY}.description`),
    keywords: 'bug bugs problema problemas relatar reportar relatório feedback captura screenshot print erro bugframe',
    master: 'canela.bug_reports_enabled',
    body: () => (
      <>
        {toggle('bug_reports_button')}
        {toggle('bug_reports_full')}
        {toggle('bug_reports_console')}
        <AdminNotice icon="fas fa-lock">{trans(`${KEY}.privacy_notice`)}</AdminNotice>
        <SubTitle>{trans(`${KEY}.reports_heading`)}</SubTitle>
        <ReportManager />
      </>
    ),
  },
];

export default cards;
