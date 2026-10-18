/*
 * "Antes deste chunk, o nosso": quando o registro do Flarum vai baixar um
 * chunk de outro pacote (o core, o flarum/messages…), um chunk do tema que o
 * estende desce primeiro. Assim as extensões do tema entram na fila do
 * `flarum.reg.onLoad` (ou o componente que o tema desenha já está pronto)
 * quando o módulo de lá chega, sem um desenho sem o tema.
 */
type Gate = { matches: (namespace: string, url: string) => boolean; load: () => Promise<unknown> };

const gates: Gate[] = [];
let installed = false;

function install(): void {
  if (installed) return;
  installed = true;

  const reg: any = flarum.reg;
  const original = reg.loadChunk;

  // Assinatura do core: (original, url, done, key, chunkId, namespace).
  reg.loadChunk = function (this: unknown, ...args: any[]) {
    const url = String(args[1] ?? '');
    const namespace = String(args[5] ?? '');
    const pending = gates.filter((gate) => gate.matches(namespace, url)).map((gate) => gate.load().catch(() => {}));

    if (!pending.length) return original.apply(this, args);

    return Promise.all(pending).then(() => original.apply(this, args));
  };
}

/** Uma vez só por carga: a promessa fica guardada (e é refeita se falhar). */
export function once<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;

  return () => {
    promise ||= load().catch((error) => {
      promise = null;
      throw error;
    });

    return promise;
  };
}

export function beforeChunk(matches: Gate['matches'], load: () => Promise<unknown>): void {
  install();
  gates.push({ matches, load });
}
