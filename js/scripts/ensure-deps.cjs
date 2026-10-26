/*
 * Antes do `build` e do `dev`: confere se todas as dependências do
 * package.json estão no node_modules e, se faltar alguma, roda o
 * `npm install`.
 *
 * Um node_modules instalado antes de uma dependência nova (o `html-to-image`
 * da captura de tela dos relatos, por exemplo) não a tem, e o webpack falha
 * com "Module not found" sem dizer o que fazer.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const missing = names.filter((name) => !fs.existsSync(path.join(root, 'node_modules', name, 'package.json')));

if (missing.length) {
  console.log(`[canela] Faltam no node_modules: ${missing.join(', ')}. Rodando npm install...`);

  // No Windows o npm é um .cmd: precisa do shell.
  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });

  if (result.status !== 0) process.exit(result.status ?? 1);
}
