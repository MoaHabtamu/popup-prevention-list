import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const upstream = process.argv[2];
assert(upstream, 'Usage: node tools/validate.mjs /path/to/pinned/uBlock [filter-list-path]');
const filterFile = process.argv[3] || 'filters.txt';
const { AstFilterParser } = await import(pathToFileURL(
    path.resolve(upstream, 'src/js/static-filtering-parser.js')
).href);
const text = await readFile(path.join(root, filterFile), 'utf8');
assert(text.endsWith('\n'), 'Filter list must end with a newline');
assert(text.startsWith('[Adblock Plus 2.0]\n'), 'Missing format header');
const header = (name) => {
    const lines = text.split('\n').filter(line => line.startsWith(`! ${name}: `));
    assert.equal(lines.length, 1, `Expected exactly one ${name} header`);
    return lines[0].slice(name.length + 4);
};
assert.match(header('Title'), /^Popup Prevention(?: - .+)?$/);
if (filterFile === 'filters.txt') assert.equal(header('Title'), 'Popup Prevention');
assert.match(header('Version'), /^\d{4}\.\d{2}\.\d{2}\.\d+$/);
const modified = header('Last modified');
assert.match(modified, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(new Date(`${modified}T00:00:00Z`).toISOString().slice(0, 10), modified);
assert.equal(header('Version').split('.').slice(0, 3).join('-'), modified);
assert.equal(header('Expires'), '1 day');
assert.equal(header('License'), 'MIT');
assert.match(header('Homepage'), /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/);

const parser = new AstFilterParser({ interactive: true });
const seen = new Set();
const allowedScriptlets = new Set(['acs', 'abort-current-script', 'nowoif', 'prevent-window-open']);
let scriptlets = 0;
let cosmetic = 0;
for (const [index, line] of text.split('\n').entries()) {
    if (line === '' || line.startsWith('!') || line.startsWith('[')) continue;
    const label = `${filterFile}:${index + 1}`;
    assert.equal(line, line.trim(), `${label}: unexpected surrounding whitespace`);
    assert(!seen.has(line), `${label}: duplicate filter`);
    seen.add(line);
    parser.parse(line);
    assert(parser.isFilter() && !parser.hasError(), `${label}: invalid upstream filter syntax`);
    const anchor = line.indexOf('##');
    assert(anchor > 0, `${label}: this list requires explicitly scoped extended filters`);
    for (const domain of line.slice(0, anchor).split(',')) {
        assert.match(domain, /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/, `${label}: invalid domain scope`);
    }
    if (parser.isScriptletFilter()) {
        const [name, property, signature] = parser.getScriptletArgs();
        assert(allowedScriptlets.has(name), `${label}: review and allow new scriptlet before adding it`);
        if (name === 'acs' || name === 'abort-current-script') {
            assert(property && signature, `${label}: script abort requires a property and script signature`);
        }
        scriptlets++;
    } else {
        assert(parser.isCosmeticFilter(), `${label}: unsupported filter category`);
        cosmetic++;
    }
}
assert(seen.size > 0, 'Filter list must not be empty');
console.log(`${filterFile}: validated ${seen.size} filters with uBlock Origin's parser (${scriptlets} scriptlet, ${cosmetic} cosmetic).`);
