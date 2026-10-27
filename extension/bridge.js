/* Runs in the extension's isolated world. Pages cannot edit this matcher. */
(() => {
  'use strict';
  const engine = globalThis.PopupPrevention;
  const CHECK = 'popup-prevention:check:v1';
  let matcher = null;
  let topHostname = '';
  let updateGeneration = 0;
  let blocked = 0;
  let lastReason = '';
  let reportTimer;

  // dispatchEvent and preventDefault are synchronous across the two worlds.
  // No service-worker round trip occurs when a page attempts a popup.
  document.addEventListener(CHECK, event => {
    if (!matcher || typeof event.detail !== 'string' || event.detail.length > 65536) return;
    let request;
    try { request = JSON.parse(event.detail); } catch { return; }
    if (!request || typeof request.url !== 'string' || typeof request.base !== 'string' ||
        typeof request.target !== 'string' || !['script', 'link', 'form'].includes(request.kind)) return;
    if (!matcher.check(request.url, request.base, request.target, request.kind)) return;
    event.preventDefault();
    blocked = Math.min(blocked + 1, 99999);
    // Only a domain/reason is kept. Never send full popup URLs to the worker.
    try { lastReason = new URL(request.url, request.base).hostname || 'blank popup'; }
    catch { lastReason = 'popup'; }
    if (reportTimer) return;
    reportTimer = setTimeout(() => {
      reportTimer = undefined;
      chrome.runtime.sendMessage({type: 'blocked', count: blocked, reason: lastReason}).catch(() => {});
    }, 200);
  }, true);

  async function load() {
    const generation = ++updateGeneration;
    try {
      const [stored, context] = await Promise.all([
        chrome.storage.local.get(['settings', 'subscription']),
        chrome.runtime.sendMessage({type: 'context'}),
      ]);
      if (generation !== updateGeneration) return;
      topHostname = context?.hostname || location.hostname;
      const subscription = stored.subscription;
      const domains = Array.isArray(subscription?.domains) ? subscription.domains : globalThis.PopupPreventionBundled;
      matcher = engine.createMatcher(domains, stored.settings, topHostname);
    } catch {
      // Preserve an already working configuration. On a first-load error use the
      // bundled list, but never guess restrictive blank/strict settings.
      if (!matcher && generation === updateGeneration) {
        matcher = engine.createMatcher(globalThis.PopupPreventionBundled, engine.DEFAULTS, topHostname);
      }
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.settings || changes.subscription)) void load();
  });
  void load();
})();
