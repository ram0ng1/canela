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

const toggle = (name: string, label: string, help: string) => (
  <AdminToggle settingKey={`canela.${name}`} label={trans(`${KEY}.${name}_label`, label)} help={trans(`${KEY}.${name}_help`, help)} />
);

const cards: CardDef[] = [
  {
    id: 'bug-reports',
    group: 'bugreports',
    icon: 'fas fa-bug',
    title: () => trans(`${KEY}.title`, 'Relatar problema'),
    description: () =>
      trans(
        `${KEY}.description`,
        'Um botão para as pessoas marcarem uma área da tela, dizerem o que está errado e enviarem. O relatório chega com a captura, a página, o tamanho da tela e os elementos sob a área. Quem pode usar fica em Permissões ("Relatar problemas"; os membros, por padrão).'
      ),
    keywords: 'bug bugs problema problemas relatar reportar relatório feedback captura screenshot print erro bugframe',
    master: 'canela.bug_reports_enabled',
    body: () => (
      <>
        {toggle(
          'bug_reports_button',
          'Botão sempre à vista',
          'O botão flutuante aparece para todos que podem reportar. Desligado, ele só aparece depois de abrir o fórum com ?bugs=1 no endereço (fica ligado naquele navegador até ?bugs=0), bom para um grupo de testes.'
        )}
        {toggle('bug_reports_full', 'Captura da tela inteira', 'Além da área marcada, guarda a tela inteira como referência.')}
        {toggle(
          'bug_reports_console',
          'Erros do console',
          'Envia junto os erros do console do navegador do último minuto. Ajuda a achar a causa, mas pode conter dados da página.'
        )}
        <AdminNotice icon="fas fa-lock">
          {trans(
            `${KEY}.privacy_notice`,
            'As capturas ficam em storage/canela-bug-reports, fora da pasta pública: só o admin e quem reportou conseguem abri-las. Campos de senha são cobertos na captura.'
          )}
        </AdminNotice>
        <SubTitle>{trans(`${KEY}.reports_heading`, 'Relatórios')}</SubTitle>
        <ReportManager />
      </>
    ),
  },
];

export default cards;
