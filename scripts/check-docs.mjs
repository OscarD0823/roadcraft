import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let checkedLinks = 0;

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    return /\.(md|html)$/i.test(entry.name) ? [path] : [];
  });
}

const documents = [
  ...readdirSync(root).filter((name) => name.endsWith('.md')).map((name) => resolve(root, name)),
  ...collect(resolve(root, 'docs')),
];

function checkTarget(document, rawTarget) {
  const target = rawTarget.replace(/^<|>$/g, '').trim();
  if (!target || target.startsWith('#') || target.startsWith('//') ||
      /^[a-z][a-z0-9+.-]*:/i.test(target)) return;

  const filePart = target.split(/[?#]/, 1)[0];
  if (!filePart) return;
  let destination;
  try {
    destination = resolve(dirname(document), decodeURIComponent(filePart));
  } catch {
    failures.push(relative(root, document) + ': URL local no válida: ' + target);
    return;
  }
  const localPath = relative(root, destination);
  checkedLinks++;
  if (localPath === '..' || localPath.startsWith('..' + sep) || isAbsolute(localPath)) {
    failures.push(relative(root, document) + ': destino fuera del repositorio: ' + target);
  } else if (!existsSync(destination)) {
    failures.push(relative(root, document) + ': archivo no encontrado: ' + target);
  }
}

for (const document of documents) {
  // Ignore code examples; check file destinations, not web URLs or heading fragments.
  const content = readFileSync(document, 'utf8')
    .replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '');
  for (const match of content.matchAll(/\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+["'][^)]*["'])?\)/g)) {
    checkTarget(document, match[1]);
  }
  for (const match of content.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    checkTarget(document, match[1]);
  }
  for (const match of content.matchAll(/^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm)) {
    checkTarget(document, match[1]);
  }
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8').replace(/\r/g, '');
const releaseDirectory = resolve(root, 'docs/releases');
for (const entry of readdirSync(releaseDirectory)) {
  if (entry.endsWith('.md') && !changelog.includes('(docs/releases/' + entry + ')')) {
    failures.push('CHANGELOG.md: falta enlazar las notas ' + entry);
  }
}
if (!existsSync(resolve(releaseDirectory, pkg.version + '.md'))) {
  failures.push('Faltan las notas de la versión actual: ' + pkg.version);
}
if (!changelog.includes('Versión actual: ' + pkg.version + '\n')) {
  failures.push('CHANGELOG.md no indica la versión actual de package.json');
}

const metadataPath = resolve(root, 'docs/version-info.json');
if (existsSync(metadataPath)) {
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  if (metadata.latestVersion !== pkg.version) {
    failures.push('docs/version-info.json no coincide con package.json');
  }
}
const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url;
const latestRelease = repository.replace(/\.git$/, '') + '/releases/latest';
for (const name of ['README.md', 'README.EN.md']) {
  if (!readFileSync(resolve(root, name), 'utf8').includes(latestRelease)) {
    failures.push(name + ': falta el enlace a la última descarga');
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Documentación correcta: ' + documents.length + ' archivos, ' +
    checkedLinks + ' destinos locales y versión ' + pkg.version + '.');
}
