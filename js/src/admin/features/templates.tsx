/*
 * Card "Modelos do editor" (extend/templates.php), no grupo "Editor e busca":
 * a chave do recurso e o painel com os modelos (./templatesAdmin): o texto
 * que preenche o composer de um tópico novo por categoria, editável ou como
 * formulário em que só os campos são preenchidos.
 */
import { AdminNotice } from '../components/AdminCard';
import { trans } from '../util';
import type { CardDef } from '../types';
import TemplateManager, { KEY } from './templatesAdmin/TemplateManager';

/** O exemplo de campo nos textos de ajuda: "{{Versão}}" no idioma do painel. */
const example = () => `{{${trans(`${KEY}.example_field`)}}}`;

const cards: CardDef[] = [
  {
    id: 'templates',
    group: 'templates',
    icon: 'fas fa-file-lines',
    title: () => trans(`${KEY}.title`),
    description: () => trans(`${KEY}.description`),
    keywords:
      'modelo modelos template templates formulário form campos suporte texto pré-preenchido pre-filled composer editor tópico novo categoria tag',
    master: 'canela.templates_enabled',
    body: () => (
      <>
        <AdminNotice icon="fas fa-circle-info">{trans(`${KEY}.notice`, { example: example() })}</AdminNotice>
        <TemplateManager />
      </>
    ),
  },
];

export default cards;
