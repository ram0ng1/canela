/*
 * O aviso "Uma versão mais recente desta página está disponível" uma vez só
 * por navegador. O core avisa uma vez por aba, a cada versão nova: com várias
 * abas abertas, ou com várias publicações seguidas (um build, depois outro
 * logo em seguida), o mesmo aviso voltava a cada recarga e em cada aba.
 *
 * Aqui o último aviso fica no navegador (versão e hora): a mesma versão não
 * avisa de novo em outra aba, e outra versão dentro de 30 minutos do último
 * aviso conta como o mesmo (recarregar já traz a mais nova de todas).
 */
import app from 'flarum/forum/app';
import { override } from 'flarum/common/extend';

const KEY = 'canela.assetsAlert';
const WINDOW_MS = 30 * 60 * 1000;

interface LastAlert {
  token: string;
  at: number;
}

function readLast(): LastAlert | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');

    return value && typeof value.token === 'string' && typeof value.at === 'number' ? value : null;
  } catch {
    return null;
  }
}

function writeLast(token: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }));
  } catch {
    // Sem armazenamento: vale a regra do core (uma vez por aba).
  }
}

export default function installAssetsAlert(): void {
  // O ForumApplication não é exportado: o método é trocado na instância (o
  // core e o flarum/realtime chamam `app.checkAssetsRevision`).
  override(app as any, 'checkAssetsRevision', function (original: (revision: string | null) => void, ...args: unknown[]) {
    const revision = typeof args[0] === 'string' ? args[0] : null;
    const booted = app.data?.assetsRevision;

    // Nada de novo para esta página: o core também não faz nada.
    if (!revision || !booted || revision === booted) return original(revision);

    const last = readLast();

    if (last && (last.token === revision || Date.now() - last.at < WINDOW_MS)) return;

    writeLast(revision);
    original(revision);
  });
}
