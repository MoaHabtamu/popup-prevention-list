import {readFile, writeFile, mkdir, cp, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const engineText = await readFile(new URL('../extension/engine.js', import.meta.url), 'utf8');
// Load our dependency-free parser in an isolated context, not arbitrary list code.
const {runInNewContext} = await import('node:vm');
const scope = {URL};
runInNewContext(engineText, scope);
const sourcePath = new URL('../extension/data/popupads.txt', import.meta.url);
const raw = await readFile(sourcePath);
const source = JSON.parse(await readFile(new URL('../extension/data/source.json', import.meta.url), 'utf8'));
if (createHash('sha256').update(raw).digest('hex') !== source.sha256) throw new Error('Bundled source checksum mismatch.');
const domains = scope.PopupPrevention.parseDomains(raw.toString('utf8'));
const generated = '// Generated from data/popupads.txt (HaGeZi, GPL-3.0). See data/source.json and data/GPL-3.0.txt.\n' +
  'globalThis.PopupPreventionBundled = Object.freeze(' + JSON.stringify(domains) + ');\n';
await writeFile(new URL('../extension/data/bundled.js', import.meta.url), generated);
await cp(new URL('../LICENSE', import.meta.url), new URL('../extension/LICENSE', import.meta.url));
const dest = root + 'dist';
await mkdir(dest, {recursive: true});
await rm(dest + '/popup-prevention', {recursive: true, force: true});
await cp(root + 'extension', dest + '/popup-prevention', {recursive: true, filter: path => !path.includes('/tests')});
await rm(dest + '/popup-prevention-0.1.0.zip', {force: true});
execFileSync('zip', ['-q', '-r', 'popup-prevention-0.1.0.zip', 'popup-prevention'], {cwd: dest});
console.log(`Packaged ${domains.length.toLocaleString()} domains: dist/popup-prevention-0.1.0.zip`);
