// Gera js/src/forum/features/composer/emoji-data.ts a partir do emojibase-data 17
// (o mesmo Unicode do twemoji 17 que o flarum/emoji usa). Uso:
//   node scripts/composer-emoji-data.cjs <pasta do emojibase-data> <arquivo de saída>
const fs = require('fs');
const path = require('path');
const [, , base, out] = process.argv;
const read = (p) => JSON.parse(fs.readFileSync(path.join(base, p), 'utf8'));

const en = read('en/compact.json');
const pt = read('pt/compact.json');
const gh = read('en/shortcodes/github.json');
const eb = read('en/shortcodes/emojibase.json');
const ptByHex = new Map(pt.map((e) => [e.hexcode, e]));

// Ordem do Discourse (o emojibase põe Viagem antes de Atividades).
const ORDER = [
  [0, 'smileys'],
  [1, 'people'],
  [3, 'nature'],
  [4, 'food'],
  [6, 'activities'],
  [5, 'travel'],
  [7, 'objects'],
  [8, 'symbols'],
  [9, 'flags'],
];

const TONE = '\u{1F3FB}';
const TONES = ['\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
const STOP = new Set(['de','da','do','das','dos','com','para','em','no','na','nos','nas','os','as','um','uma','ao','with','on','the','of','and','in','to','for','at']);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);

let skinCount = 0;
const groups = ORDER.map(([id, key]) => {
  const rows = en
    .filter((e) => e.group === id)
    .sort((a, b) => a.order - b.order)
    .map((e) => {
      const shortcodes = [...new Set([...list(gh[e.hexcode]), ...list(eb[e.hexcode])])];
      const p = ptByHex.get(e.hexcode);
      const words = new Set();
      [e.label, p && p.label, ...(p ? list(p.tags) : []), ...list(e.tags)].filter(Boolean).forEach((w) =>
        norm(w)
          .split(/[^a-z0-9+]+/)
          .filter((x) => x.length > 1 && !STOP.has(x))
          .forEach((x) => words.add(x))
      );
      shortcodes.forEach((s) => s.split('_').forEach((x) => words.delete(x)));
      const row = [e.unicode, shortcodes.join(' ') || norm(e.label).replace(/[^a-z0-9]+/g, '_'), [...words].join(' ')];

      // Tom de pele: só os cinco tons "uniformes" (todas as pessoas do mesmo tom).
      const skins = list(e.skins).map((s) => s.unicode);
      if (skins.length >= 5) {
        const light = skins.find((s) => s.includes(TONE) && !TONES.slice(1).some((t) => s.includes(t)));
        if (light) {
          const template = light.split(TONE).join('~');
          const ok = TONES.every((t) => skins.includes(template.split('~').join(t)));
          if (ok) {
            row.push(template);
            skinCount++;
          }
        }
      }
      return row;
    });
  return { key, emoji: rows };
});

const header = `/*
 * Lista de emoji do seletor do composer, gerada a partir do emojibase-data 17
 * (MIT, © Miles Johnson) — a mesma versão do Unicode do twemoji 17 que o
 * flarum/emoji desenha. Arquivo gerado: não edite à mão.
 *
 * Cada emoji é [caractere, atalhos (o primeiro é o principal), palavras de
 * busca em inglês e português sem acento, modelo do tom de pele?]. No modelo,
 * "~" marca onde entra o modificador do tom (U+1F3FB a U+1F3FF).
 *
 * Fica num módulo próprio, carregado com import() só quando o seletor abre:
 * são ~2 mil linhas que quem só lê o fórum nunca precisa baixar.
 */
export type EmojiRow = [string, string, string, string?];

export interface EmojiGroup {
  key: string;
  emoji: EmojiRow[];
}

`;
const body = 'const EMOJI_GROUPS: EmojiGroup[] = [\n' +
  groups.map((g) => `  {\n    key: ${JSON.stringify(g.key)},\n    emoji: [\n` + g.emoji.map((r) => '      ' + JSON.stringify(r) + ',').join('\n') + '\n    ],\n  },').join('\n') +
  '\n];\n\nexport default EMOJI_GROUPS;\n';
fs.writeFileSync(out, header + body);
console.log('emoji:', groups.reduce((n, g) => n + g.emoji.length, 0), 'com tom:', skinCount, 'bytes:', fs.statSync(out).size);
