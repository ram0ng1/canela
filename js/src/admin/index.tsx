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
 * a posição dentro do grupo vem de ORDER, abaixo (o que não estiver lá vai
 * para o fim do grupo). As chaves e os padrões são os da tabela
 * `$forumSettings` do extend.php e dos extend/<recurso>.php.
 */
import normalizeRevManifest from '../common/revManifest';
import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import { override } from 'flarum/common/extend';

import { trans } from './util';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import { lazyComponent } from '../forum/utils/lazy';

const EXTENSION_ID = 'ramon-canela';
const KEY = 'ramon-canela.admin.settings';

/** A ordem dos cards dentro de cada grupo — do mais visível ao mais específico. */
const Panel = lazyComponent(
  () => import('./panel').then((mod) => mod.default),
  () => <LoadingIndicator />
);

// Todos os controles salvam sozinhos: o botão Salvar nativo só confundiria.
override(ExtensionPage.prototype, 'submitButton', function (this: ExtensionPage, original: () => any) {
  if (this.extension?.id === EXTENSION_ID) return null;

  return original();
});

app.initializers.add(EXTENSION_ID, () => {
  // Antes de qualquer chunk: as chaves das revisões no Windows (ver o arquivo).
  normalizeRevManifest();
  // Um único item no registro: a casca desenha os grupos e os cards.
  app.registry.for(EXTENSION_ID).registerSetting(() => m(Panel), 100);

  // Quem pode gerar links de convite (gaps: extend/gaps.php).
  app.registry.for(EXTENSION_ID).registerPermission(
    {
      icon: 'fas fa-user-plus',
      label: trans(`${KEY}.gaps.invite_permission`, 'Convidar pessoas (links de convite)'),
      permission: 'canela.createInvite',
    },
    'start',
    80
  );
});
