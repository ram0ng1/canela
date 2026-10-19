/*
 * Páginas do tema que outra extensão já ocupa cedem o lugar, como as rotas do
 * backend (src/Support/GuardedRouteCollection.php).
 *
 * O roteador do Flarum monta a tabela pelo caminho: com duas rotas em
 * `/badges` (a do tema e a do fof/badges), vale a última registrada, e o
 * servidor e o navegador podiam escolher páginas diferentes. Aqui, antes de o
 * app montar o roteador, cada rota `canela.*` cujo caminho outra extensão
 * também registra passa a apontar para a rota dela: o caminho fica com a
 * outra extensão, e os links do tema (`app.route('canela.badges')`) continuam
 * funcionando, levando à página dela.
 */
import app from 'flarum/forum/app';

type RouteMap = Record<string, { path: string; component?: unknown; resolver?: unknown }>;

export function yieldConflictingRoutes(routes: RouteMap = app.routes as RouteMap): string[] {
  const byPath = new Map<string, string[]>();

  for (const [name, route] of Object.entries(routes)) {
    if (!route?.path) continue;

    const names = byPath.get(route.path) ?? [];
    names.push(name);
    byPath.set(route.path, names);
  }

  const yielded: string[] = [];

  for (const names of byPath.values()) {
    const theirs = names.filter((name) => !name.startsWith('canela'));

    if (!theirs.length) continue;

    for (const name of names) {
      if (!name.startsWith('canela')) continue;

      routes[name] = routes[theirs[0]];
      yielded.push(name);
    }
  }

  return yielded;
}
