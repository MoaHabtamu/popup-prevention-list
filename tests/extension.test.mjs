import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read = file => readFile(new URL('../extension/' + file, import.meta.url), 'utf8');
const [engineCode, bridgeCode, hookCode, workerCode] = await Promise.all(
  ['engine.js', 'bridge.js', 'intercept.js', 'background.js'].map(read));
function engine() {
  const scope = {URL};
  vm.runInNewContext(engineCode, scope);
  return scope.PopupPrevention;
}
class CustomEvent extends Event {
  constructor(type, options = {}) { super(type, options); this.detail = options.detail; }
}
const flush = () => new Promise(resolve => setImmediate(resolve));

async function harness(settings = {}, {defer = false} = {}) {
  const document = new EventTarget();
  document.baseURI = 'https://watch.example/movie';
  document.URL = document.baseURI;
  document.querySelector = () => null;
  const calls = [];
  class Frame {
    constructor(child) { this.child = child; }
    get contentWindow() { return this.child; }
    get contentDocument() { return {defaultView: this.child}; }
  }
  class Form {
    constructor(action, target) { this.action = action; this.target = target; }
    getAttribute(name) { return name === 'target' ? this.target : null; }
    submit() { calls.push({form: this.action}); }
  }
  const window = {document, HTMLIFrameElement: Frame, open(...args) { calls.push({args, receiver: this}); return {allowed: true}; }};
  const stored = {settings};
  const listeners = [];
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const chrome = {
    storage: {
      local: {get: async () => { if (defer) await pending; return stored; }},
      onChanged: {addListener: fn => listeners.push(fn)},
    },
    runtime: {sendMessage: async request => request.type === 'context' ? {hostname: 'watch.example'} : undefined},
  };
  const isolated = {URL, document, chrome, location: {hostname: 'watch.example'}, setTimeout: () => 1};
  vm.runInNewContext(engineCode, isolated);
  isolated.PopupPreventionBundled = ['ad.example', 'tracker.example'];
  vm.runInNewContext(bridgeCode, isolated);
  const main = {window, document, CustomEvent, Event, EventTarget, URL, HTMLFormElement: Form};
  vm.runInNewContext(hookCode, main);
  await flush();
  return {window, document, calls, Frame, Form, main, isolated,
    async configure(next) {
      stored.settings = next;
      for (const listener of listeners) listener({settings: {}}, 'local');
      await flush();
    },
    async ready() { release(); await flush(); },
  };
}

test('domain parsing rejects uBO rules, hosts format and malformed entries instead of guessing', () => {
  const e = engine();
  assert.deepEqual(Array.from(e.parseDomains('# heading\nADS.example.\nads.example\n! comment\n')), ['ads.example']);
  for (const text of ['||ads.example^$popup', '0.0.0.0 ads.example', 'ads.example/path', 'https://ads.example', '*.example.com', 'a..example', 'bad<script>.example', '192.168.1.1']) {
    assert.throws(() => e.parseDomains(text), /Unsupported/);
  }
  assert.equal(e.normalizeDomain('bücher.example'), 'xn--bcher-kva.example');
});

test('hostname matching includes subdomains but never matches URL text or suffix lookalikes', () => {
  const m = engine().createMatcher(['ad.example'], {}, 'watch.example');
  assert.equal(m.check('https://x.ad.example/p', 'https://watch.example'), true);
  for (const url of ['https://notad.example/', 'https://ad.example.evil.test/', 'https://safe.example/ad.example', 'https://ad.example@safe.example/', '/ad.example']) {
    assert.equal(m.check(url, 'https://watch.example'), false, url);
  }
  assert.equal(m.check('https://AD.EXAMPLE./', 'https://watch.example'), true);
});

test('exceptions, disabled mode, and strict/blank policies have explicit precedence', () => {
  const e = engine();
  assert.equal(e.createMatcher(['ad.example'], {enabled: false}).check('https://ad.example', 'https://watch.example'), false);
  assert.equal(e.createMatcher(['ad.example'], {siteAllowlist: 'watch.example'}, 'child.watch.example').check('https://ad.example', 'https://watch.example'), false);
  const m = e.createMatcher(['ad.example'], {strict: true, destinationAllowlist: 'ad.example'});
  assert.equal(m.check('https://ad.example', 'https://watch.example'), false);
  assert.equal(m.check('https://safe.example', 'https://watch.example'), true);
  assert.equal(m.check('https://safe.example', 'https://watch.example', '_blank', 'link'), false);
  assert.equal(m.check('https://ad.example', 'https://watch.example', '_self'), false);
  assert.equal(e.createMatcher([], {}).check('', 'https://watch.example'), false);
  assert.equal(e.createMatcher([], {blockBlank: true}).check('about:blank', 'https://watch.example'), true);
});

test('blocked window.open returns null without ever calling the browser function', async () => {
  const h = await harness();
  assert.equal(h.window.open('https://ad.example/path', '_blank'), null);
  assert.equal(h.calls.length, 0);
  const opened = h.window.open('https://safe.example', 'login', 'width=400');
  assert.equal(opened.allowed, true);
  assert.deepEqual(Array.from(h.calls[0].args), ['https://safe.example', 'login', 'width=400']);
  assert.equal(h.calls[0].receiver, h.window);
  assert.equal(h.main.PopupPrevention, undefined, 'page world does not receive the matcher');
});

test('relative URLs resolve against the document base and argument conversion happens once', async () => {
  const h = await harness({customBlocklist: 'watch.example'});
  assert.equal(h.window.open('/advert'), null);
  let conversions = 0;
  const input = {toString() { conversions++; return 'https://safe.example'; }};
  h.window.open(input);
  assert.equal(conversions, 1);
  assert.equal(h.calls[0].args[0], 'https://safe.example');
  h.window.open('https://ad.example', '_self');
  assert.equal(h.calls.length, 2, 'existing-context navigation is preserved');
});

test('blank windows remain compatible by default, with an opt-in no-blank policy', async () => {
  const h = await harness();
  h.window.open();
  assert.equal(h.calls.length, 1);
  await h.configure({blockBlank: true});
  assert.equal(h.window.open(), null);
  assert.equal(h.calls.length, 1);
  await h.configure({enabled: false, blockBlank: true});
  h.window.open();
  assert.equal(h.calls.length, 2);
});

test('fresh same-origin iframe contentWindow and contentDocument cannot supply an unpatched open', async () => {
  const h = await harness();
  const makeChild = () => ({document: h.document, open() { h.calls.push('child'); }});
  const first = new h.Frame(makeChild());
  assert.equal(first.contentWindow.open('https://ad.example'), null);
  const second = new h.Frame(makeChild());
  assert.equal(second.contentDocument.defaultView.open('https://tracker.example'), null);
  assert.equal(h.calls.length, 0);
  first.contentWindow.open('https://safe.example');
  assert.equal(h.calls.length, 1);
});

function linkEvent(document, href, {target = '_blank', button = 0, ctrlKey = false, download = false} = {}) {
  const node = {localName: 'a', href,
    hasAttribute: key => key === 'href' || (key === 'download' && download),
    getAttribute: key => key === 'target' ? target : null};
  const event = new Event(button === 1 ? 'auxclick' : 'click', {cancelable: true});
  Object.assign(event, {button, ctrlKey, metaKey: false, shiftKey: false, composedPath: () => [node, document]});
  document.dispatchEvent(event);
  return event.defaultPrevented;
}
test('new-tab links, keyboard-modified clicks, and middle clicks are canceled before default navigation', async () => {
  const h = await harness();
  assert.equal(linkEvent(h.document, 'https://ad.example'), true);
  assert.equal(linkEvent(h.document, 'https://ad.example', {target: '', ctrlKey: true}), true);
  assert.equal(linkEvent(h.document, 'https://ad.example', {target: '', button: 1}), true);
  assert.equal(linkEvent(h.document, 'https://ad.example', {target: ''}), false);
  assert.equal(linkEvent(h.document, 'https://safe.example'), false);
  assert.equal(linkEvent(h.document, 'https://ad.example', {download: true}), false);
});

test('native form.submit and submit-event overrides are checked without opening a context', async () => {
  const h = await harness();
  new h.Form('https://ad.example', '_blank').submit();
  assert.equal(h.calls.length, 0);
  new h.Form('https://safe.example', '_blank').submit();
  assert.equal(h.calls.length, 1);
  const form = new h.Form('https://safe.example', '_blank');
  const event = new Event('submit', {cancelable: true});
  Object.defineProperties(event, {
    target: {value: form},
    submitter: {value: {hasAttribute: key => key === 'formaction', formAction: 'https://ad.example'}},
  });
  h.document.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
});

test('preferences load asynchronously: fail open first, then block without asynchronous per-call work', async () => {
  const h = await harness({}, {defer: true});
  h.window.open('https://ad.example');
  assert.equal(h.calls.length, 1, 'known startup limitation is covered, not concealed');
  await h.ready();
  assert.equal(h.window.open('https://ad.example'), null);
  assert.equal(h.calls.length, 1);
});

test('worker validates downloads and preserves the previous list after failures', async () => {
  const old = {domains: ['old.example'], source: 'https://list.example/domains', updatedAt: 1};
  const stored = {settings: {sourceUrl: old.source}, subscription: old};
  let handler;
  let contents = 'new.example\n';
  const worker = {
    URL, Uint8Array, TextDecoder, AbortSignal,
    fetch: async () => new Response(contents),
    importScripts: () => {},
    chrome: {
      storage: {local: {get: async () => stored, set: async values => Object.assign(stored, values)}},
      alarms: {create: async () => {}, onAlarm: {addListener() {}}},
      runtime: {
        onInstalled: {addListener() {}}, onStartup: {addListener() {}},
        onMessage: {addListener(fn) { handler = fn; }},
        getURL: () => 'chrome-extension://test/',
      },
    },
  };
  vm.createContext(worker);
  vm.runInContext(engineCode, worker);
  vm.runInContext(workerCode, worker);
  assert.equal(handler({type: 'update-list'}, {url: 'https://evil.example/'}, () => {}), undefined);
  const result = await vm.runInContext('updateList()', worker);
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(stored.subscription.domains), ['new.example']);
  const lastGood = stored.subscription;
  for (contents of ['', '<html>error</html>', '||wrong-format.example^']) {
    const failed = await vm.runInContext('updateList()', worker);
    assert.equal(failed.ok, false);
    assert.equal(stored.subscription, lastGood);
  }
  contents = 'x'.repeat(3 * 1024 * 1024 + 1);
  assert.equal((await vm.runInContext('updateList()', worker)).ok, false);
  assert.equal(stored.subscription, lastGood);
});

test('manifest packages both isolated matcher and MAIN hook at document start in frames', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage', 'alarms']);
  assert.equal(manifest.content_scripts.length, 2);
  for (const script of manifest.content_scripts) {
    assert.equal(script.run_at, 'document_start');
    assert.equal(script.all_frames, true);
    assert.equal(script.match_origin_as_fallback, true);
    for (const file of script.js) await read(file);
  }
  assert.equal(manifest.content_scripts[1].world, 'MAIN');
});
