importScripts('engine.js');
const engine = globalThis.PopupPrevention;
let updating;

async function readList(response) {
  if (!response.ok) throw new Error('List server returned HTTP ' + response.status + '.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3 * 1024 * 1024) throw new Error('List exceeds 3 MiB.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', {fatal: true}).decode(buffer);
}

async function refresh() {
  const stored = await chrome.storage.local.get('settings');
  const settings = engine.settingsFrom(stored.settings);
  const source = settings.sourceUrl;
  try {
    const response = await fetch(source, {
      credentials: 'omit', cache: 'no-cache', redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    const domains = engine.parseDomains(await readList(response));
    if (domains.length === 0) throw new Error('List is empty. Keeping the last working list.');
    // A user can change sources while the old fetch is in flight.
    const latest = await chrome.storage.local.get('settings');
    if (engine.settingsFrom(latest.settings).sourceUrl !== source) return {ok: false, error: 'List source changed; update again.'};
    await chrome.storage.local.set({
      subscription: {domains, source, updatedAt: Date.now()},
      updateStatus: {ok: true, checkedAt: Date.now(), count: domains.length},
    });
    return {ok: true, count: domains.length};
  } catch (error) {
    const message = String(error.message || error).slice(0, 300);
    await chrome.storage.local.set({updateStatus: {ok: false, checkedAt: Date.now(), error: message}});
    return {ok: false, error: message};
  }
}
function updateList() {
  if (!updating) updating = refresh().finally(() => { updating = undefined; });
  return updating;
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create('refresh-list', {periodInMinutes: 1440});
  void updateList();
});
chrome.runtime.onStartup.addListener(() => {
  void chrome.alarms.create('refresh-list', {periodInMinutes: 1440});
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'refresh-list') void updateList();
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'context' && sender.tab) {
    let hostname = '';
    try { hostname = new URL(sender.tab.url).hostname; } catch {}
    respond({hostname});
    return;
  }
  if (message?.type === 'blocked' && sender.tab &&
      Number.isInteger(message.count) && message.count > 0 && message.count <= 99999) {
    // Frame-local counts are diagnostic only: pages can imitate DOM events.
    void chrome.action.setBadgeText({tabId: sender.tab.id, text: '×'}).catch(() => {});
    void chrome.action.setBadgeBackgroundColor({tabId: sender.tab.id, color: '#265d46'}).catch(() => {});
    return;
  }
  // Remote pages/content scripts cannot use the worker as a fetch service.
  if (message?.type === 'update-list' &&
      typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''))) {
    updateList().then(respond, error => respond({ok: false, error: String(error.message)}));
    return true;
  }
});
