/*
 * Painel do tema no admin.
 *
 * Os cards moram em GRUPOS (Aparência · Cabeçalho e barra lateral · Lista ·
 * Tópico · Editor e busca · Perfil e usuários · Mensagens e chat · Comunidade
 * · Moderação · Integrações · IA), na ordem em que se percorre o fórum. Cada
 * recurso é um card com a chave liga/desliga no cabeçalho; desligada, o miolo
 * some, e os cards e opções que dependem dela somem também (ver
 * components/SettingsPanel e util: registerDeps/isOn).
 *
 * Os cards do tema base estão em ./cards/core e os dos recursos com backend em
 * ./features/*. Card novo = uma entrada numa dessas listas, com um `id` único;
 * a posição dentro do grupo vem de ORDER, em panel.tsx (o que não estiver lá vai
 * para o fim do grupo). As chaves e os padrões são os da tabela
 * `$forumSettings` do extend.php e dos extend/<recurso>.php.
 */
import normalizeRevManifest from '../common/revManifest';
import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import { override } from 'flarum/common/extend';

import adminExtend from './extend';

const EXTENSION_ID = 'ramon-canela';

// O painel e as permissões: ./extend.tsx.
export const extend = [...adminExtend];

// Todos os controles salvam sozinhos: o botão Salvar nativo só confundiria.
override(ExtensionPage.prototype, 'submitButton', function (this: ExtensionPage, original: () => any) {
  if (this.extension?.id === EXTENSION_ID) return null;

  return original();
});

app.initializers.add(EXTENSION_ID, () => {
  // Antes de qualquer chunk: as chaves das revisões no Windows (ver o arquivo).
  normalizeRevManifest();
});
