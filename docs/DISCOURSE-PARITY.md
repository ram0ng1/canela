# Paridade com o Discourse

Inventário dos recursos do Discourse (núcleo + plugins que vêm junto) e onde cada um mora no Canela.
Pedido do usuário: **todos os recursos, sem exceção.** Legenda de origem:

- **core**: já existe no Flarum 2 ou numa extensão oficial (o Canela só redesenha).
- **canela-ui**: o Canela implementa só no front-end.
- **canela-api**: o Canela implementa com backend próprio (`extend/<recurso>.php`, `src/<Recurso>/`, migrations).
- **ext**: há extensão do Flarum que cobre; o Canela dá suporte visual e o admin indica a extensão.

| Área | Recurso do Discourse | Origem no Canela | Responsável |
|---|---|---|---|
| Casca | Cabeçalho com hambúrguer, logo, busca, idioma, notificações, avatar | canela-ui | casca |
| Casca | Barra lateral com seções recolhíveis (Comunidade, Categorias, Etiquetas, Mensagens) | canela-ui | casca |
| Casca | Personalizar a barra lateral (escolher categorias/etiquetas) | canela-ui (preferência local) | editor/extras |
| Casca | Rodapé da barra: tema, atalhos, novo tópico | canela-ui | casca |
| Casca | Atalhos de teclado + janela "?" | canela-ui | casca |
| Casca | Tamanho do texto (menor/normal/maior/máximo) nas preferências | canela-ui | editor/extras |
| Casca | Banner de anúncio global (tópico-banner) | canela-api (setting) | editor/extras |
| Lista | Recentes, Em alta, Novos, Não lidos, Melhores, Categorias | core + canela-ui | lista |
| Lista | Melhores por período (dia/semana/mês/trimestre/ano/sempre) | canela-ui | lista |
| Lista | Colunas Postadores, Respostas, Visualizações, Atividade + heat | canela-ui + canela-api (views) | lista / estatísticas |
| Lista | Contagens "Novos (N)" e "Não lidos (N)" | canela-api | estatísticas |
| Lista | Seleção em massa (staff) | canela-ui | editor/extras |
| Lista | Dispensar novos/não lidos | core | lista |
| Lista | Banner de boas-vindas, hero da categoria, subcategorias | canela-ui | lista |
| Categorias | Página de categorias (caixas/lista), página de etiquetas | core (tags) + canela-ui | lista |
| Tópico | Linha do tempo, mapa do tópico, rodapé, sugeridos, small actions | canela-ui | tópico |
| Tópico | Ações do post: curtir, compartilhar, marcador, "…" expansível, responder | core + canela-ui | tópico / marcadores |
| Tópico | Respostas embutidas, "em resposta a", citar seleção, destaque do post | core (mentions) + canela-ui | tópico |
| Tópico | Nível de notificação do tópico (observar/acompanhar/normal/silenciar) | core (subscriptions) + canela-ui | tópico |
| Tópico | Contagem de visualizações | canela-api | estatísticas |
| Tópico | Compartilhar (copiar link, e-mail, redes) | canela-ui | tópico |
| Tópico | Responder como tópico vinculado | canela-ui | editor/extras |
| Tópico | Imprimir tópico | canela-ui | editor/extras |
| Tópico | Histórico de edições | canela-api | editor/extras |
| Tópico | Enquetes | ext (fof/polls) | — |
| Tópico | Solução aceita | ext (fof/best-answer) | — |
| Tópico | Reações | ext (fof/reactions) | — |
| Marcadores | Marcar posts, nome, lembrete, lista no perfil e no menu | canela-api | marcadores |
| Usuário | Cartão do usuário | canela-ui | tópico |
| Usuário | Perfil com capa, estatísticas, abas, resumo | canela-ui | perfil |
| Usuário | Bio, local, site, título, status (emoji + texto) | canela-api | perfil estendido |
| Usuário | Capa e fundo do cartão por imagem | canela-api | perfil estendido |
| Usuário | Estatísticas: dias visitados, tempo de leitura, tópicos vistos, posts lidos | canela-api | estatísticas |
| Usuário | Níveis de confiança (0–4) | canela-api | emblemas |
| Usuário | Emblemas (badges) automáticos + página /badges | canela-api | emblemas |
| Usuário | Menu do usuário com abas (todas, respostas, curtidas, mensagens, marcadores, perfil) | canela-ui | perfil / marcadores |
| Usuário | Mensagens privadas | core (flarum/messages) | — |
| Usuário | Preferências: conta, perfil, notificações, interface | core + canela-ui | perfil |
| Comunidade | Página Sobre (/about) com equipe e estatísticas | canela-api | comunidade |
| Comunidade | Diretório de usuários (/u) com período e ordenação | canela-api | comunidade |
| Comunidade | Grupos (/g) e página do grupo | core API + canela-ui | comunidade |
| Editor | Composer encaixado, prévia, barra de ferramentas | core + canela-ui | componentes |
| Editor | Seletor de emoji | canela-ui | editor/extras |
| Editor | Tópicos semelhantes ao digitar o título | canela-ui | editor/extras |
| Editor | #categoria / #etiqueta com autocompletar | canela-ui | editor/extras |
| Editor | Rascunhos (⌄ do Novo tópico, menu, perfil) | fof/drafts | editor |
| Busca | Menu de busca + página de busca com filtros avançados | core + canela-ui | componentes / editor/extras |
| Moderação | Sinalizar, fila de revisão, aprovação | core (flags, approval) | componentes |
| Fora do escopo de um tema | Chat, IA, ActivityPub, e-mails de resumo | — | documentado no README |
