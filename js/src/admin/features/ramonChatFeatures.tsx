/*
 * Card dos recursos de chat que o tema põe por cima do ramon/chat
 * (extend/ramonchat.php + js/src/forum/thirdparty/ramonChat/features): uma
 * chave por recurso, todas `canela.ramonchat_*`, e o limite de participantes
 * das MDs. Sem o ramon/chat o card fica trancado; se extend/ramonchat.php não
 * carregou (ver o log de erros), também: os padrões só existem com ele.
 */
import app from 'flarum/admin/app';
import isExtensionEnabled from 'flarum/admin/utils/isExtensionEnabled';

import AdminNumber from '../components/AdminNumber';
import AdminToggle from '../components/AdminToggle';
import { trans } from '../util';
import type { CardDef } from '../types';

const KEY = 'ramon-canela.admin.settings.ramon_chat_features';
const MASTER = 'canela.ramonchat_features';

const toggle = (name: string, label: string, help: string, dependsOn?: string) => (
  <AdminToggle
    settingKey={`canela.ramonchat_${name}`}
    label={trans(`${KEY}.${name}_label`, label)}
    help={trans(`${KEY}.${name}_help`, help)}
    dependsOn={dependsOn}
  />
);

const heading = (name: string, fallback: string) => <h4 className="CanelaAdmin-subTitle">{trans(`${KEY}.${name}`, fallback)}</h4>;

const cards: CardDef[] = [
  {
    id: 'ramon-chat-features',
    group: 'messages',
    icon: 'fas fa-comments',
    title: () => trans(`${KEY}.title`, 'Recursos extras do chat (ramon/chat)'),
    description: () =>
      trans(
        `${KEY}.description`,
        'O que o ramon/chat não tem: avisos no sino, reações de um clique, "Nova mensagem", favoritos, link da mensagem, "está digitando" sem websocket e mais: sem mudar a extensão.'
      ),
    keywords:
      'chat ramon recursos extras sino notificações reações favoritos estrela nova mensagem grupo link restaurar digitando atalho preferências denúncias revisar flags moderação',
    master: MASTER,
    extensions: ['ramon-chat'],
    lockedBy: () =>
      isExtensionEnabled('ramon-chat') && app.data.settings[MASTER] === undefined
        ? trans(`${KEY}.backend_off`, 'O recurso "ramonchat" do tema não carregou (veja o log de erros do PHP).')
        : null,
    body: () => [
      heading('group_reader', 'Para o leitor'),
      toggle(
        'preferences',
        'Seção "Chat" nas Configurações',
        'Ativar o chat, som, indicador do cabeçalho, tecla de enviar, reações de um clique, gaveta, e-mail de menções e "Ignorar menções em todo o canal".'
      ),
      toggle(
        'header_indicator',
        'Indicador do cabeçalho configurável',
        'O leitor escolhe o que o botão do chat conta: todas as novas, MDs e menções, só menções ou nada.'
      ),
      toggle('drawer_shortcut', 'Atalho "-" para a gaveta', 'Abre e fecha a gaveta do chat.'),
      toggle(
        'bell',
        'Avisos no sino',
        'Menções (@here só para quem esteve ativo nos últimos 5 minutos) e mensagens novas nos canais acompanhados viram notificações; ler o canal as marca como lidas.'
      ),

      heading('group_messages', 'Mensagens'),
      toggle('quick_reactions', 'Reações de um clique', 'As três reações mais usadas pelo leitor (ou as que ele escolher) ao lado do 👍.'),
      toggle('permalink', 'Link da mensagem', '"Copiar link" nas ações e o endereço que abre a conversa na mensagem.'),
      toggle('restore', 'Restaurar mensagem excluída', 'O botão no aviso de mensagem excluída, para quem pode restaurá-la.'),
      toggle('long_press', 'Ações por toque longo no celular', 'Segurar a mensagem abre a folha de ações que sobe de baixo.'),
      toggle('collapse_deleted', 'Agrupar excluídas em sequência', '"N mensagens foram excluídas" numa linha só, com "ver todas".'),
      toggle('paste_upload', 'Colar e arrastar imagens', 'Imagens e arquivos colados ou soltos no compositor são enviados como anexo.'),
      toggle('mention_warning', 'Aviso de quem não participa', 'No @ do compositor, quem não está no canal aparece com "não participa do canal".'),
      toggle(
        'typing_poll',
        '"Está digitando" sem websocket',
        'Sem o flarum/realtime, quem está com a conversa aberta pergunta ao servidor a cada 3 segundos.'
      ),

      heading('group_channels', 'Canais e MDs'),
      toggle(
        'new_message',
        '"Nova mensagem"',
        'O modal de MD e MD em grupo (busca de pessoas, contador, nome do grupo) e o "+" das Mensagens diretas.'
      ),
      toggle('self_dm', 'MD consigo mesmo ("Anotar algo")', 'Uma conversa só sua, para anotações.'),
      toggle('group_name', 'Nome do chat em grupo', 'Qualquer participante muda o nome da conversa em grupo.'),
      toggle('starred', 'Canais favoritos', 'A estrela no cabeçalho e nas Informações do canal; os favoritos vão para o topo da barra lateral.'),
      toggle(
        'pin_bar',
        'Faixa das fixadas',
        'A faixa acompanha o trecho da conversa à vista, com o indicador de várias fixadas; clicar percorre todas, o "×" oculta a faixa só para o leitor, e o painel lista na ordem da conversa, com quem fixou.'
      ),
      toggle('pin_indicator', 'Fixadas não vistas', 'Um ponto na faixa da mensagem fixada quando há fixada que o leitor ainda não abriu.'),
      toggle('retention', 'Lembrete de retenção', 'Por quanto tempo as mensagens ficam guardadas, nas Informações do canal.'),
      toggle('delete_confirm', 'Excluir canal digitando o nome', 'Excluir um canal pede o nome dele digitado, em vez de um "OK".'),
      toggle(
        'auto_join',
        'Entrar sozinho nos canais automáticos',
        'Quem ganhou acesso depois entra nos canais com "Adicionar usuários automaticamente" (no máximo uma vez por dia por pessoa).'
      ),
      toggle('tag_cleanup', 'Apagar os canais da tag apagada', 'Ao apagar uma tag, os canais dela são excluídos.'),

      heading('group_moderation', 'Moderação'),
      toggle(
        'review_flags',
        'Denúncias do chat em "Revisar"',
        'As mensagens do chat denunciadas entram na fila de revisão do tema (página, barra lateral e menu do usuário), junto com as postagens e na ordem das datas, para quem vê as sinalizações ou modera o chat.'
      ),
      toggle('dm_guard', 'Regras das MDs', 'Recusa MD com quem não pode usar o chat ou o desligou, e aplica o limite de participantes abaixo.'),
      <AdminNumber
        settingKey="canela.ramonchat_dm_max"
        label={trans(`${KEY}.dm_max_label`, 'Participantes por MD')}
        help={trans(`${KEY}.dm_max_help`, 'Contando quem começa a conversa. O ramon/chat aceita no máximo 20.')}
        min={2}
        max={20}
        fallback={20}
      />,
    ],
  },
];

export default cards;
