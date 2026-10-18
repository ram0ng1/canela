/*
 * Diff por palavras, sem bibliotecas, para o histórico de edições.
 *
 * O texto vira uma lista de "tokens" (palavras e os espaços entre elas, que
 * também contam: uma quebra de linha nova é uma mudança). O prefixo e o sufixo
 * em comum saem antes — numa edição típica só um trecho do meio muda, e isso
 * reduz a conta pesada a poucos tokens. No miolo, a maior subsequência comum
 * (LCS) por programação dinâmica decide o que ficou, o que saiu e o que entrou.
 *
 * A tabela da LCS cresce com n×m; acima do teto (textos enormes reescritos
 * quase inteiros) o miolo vira "tudo saiu, tudo entrou" — menos preciso, mas
 * sem travar a aba.
 */

export type DiffKind = 'equal' | 'insert' | 'delete';

export interface DiffPart {
  kind: DiffKind;
  text: string;
}

/** ~4 milhões de células: 16 MB de Uint32, alguns décimos de segundo no pior caso. */
const MAX_CELLS = 4_000_000;

export function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) || [];
}

function push(parts: DiffPart[], kind: DiffKind, text: string): void {
  if (!text) return;

  const last = parts[parts.length - 1];

  if (last && last.kind === kind) last.text += text;
  else parts.push({ kind, text });
}

function lcsDiff(a: string[], b: string[], parts: DiffPart[]): void {
  const n = a.length;
  const m = b.length;

  if ((n + 1) * (m + 1) > MAX_CELLS) {
    push(parts, 'delete', a.join(''));
    push(parts, 'insert', b.join(''));
    return;
  }

  // lengths[i][j] = LCS de a[i..] e b[j..], numa tabela linear.
  const width = m + 1;
  const lengths = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i * width + j] =
        a[i] === b[j] ? lengths[(i + 1) * width + j + 1] + 1 : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }

  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(parts, 'equal', a[i]);
      i++;
      j++;
    } else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) {
      push(parts, 'delete', a[i++]);
    } else {
      push(parts, 'insert', b[j++]);
    }
  }

  while (i < n) push(parts, 'delete', a[i++]);
  while (j < m) push(parts, 'insert', b[j++]);
}

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const parts: DiffPart[] = [];

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  push(parts, 'equal', a.slice(0, start).join(''));
  lcsDiff(a.slice(start, endA), b.slice(start, endB), parts);
  push(parts, 'equal', a.slice(endA).join(''));

  return parts;
}

/** Quantas palavras entraram e saíram — o resumo "+12 −3" do cabeçalho. */
export function diffStats(parts: DiffPart[]): { added: number; removed: number } {
  const words = (text: string) => tokenize(text).filter((token) => token.trim()).length;

  return parts.reduce(
    (stats, part) => {
      if (part.kind === 'insert') stats.added += words(part.text);
      if (part.kind === 'delete') stats.removed += words(part.text);
      return stats;
    },
    { added: 0, removed: 0 }
  );
}
