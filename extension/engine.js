/* Popup Prevention — MIT. Domain rules, not the uBlock filtering engine. */
(() => {
  'use strict';
  const MAX_DOMAINS = 100000;
  const DEFAULT_SOURCE = 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/popupads-onlydomains.txt';
  const DEFAULTS = Object.freeze({
    enabled: true, blockBlank: false, strict: false,
    siteAllowlist: '', destinationAllowlist: '', customBlocklist: '',
    sourceUrl: DEFAULT_SOURCE,
  });
  // Destinations observed in the original investigation. Never block player hosts.
  const SEEDS = ['geniusdexchange.com', 'stellarconductornexus.com',
    'pagerrentablespotlight.com', 'ps.upmostseax.com', 'rq.alchemmauls.com'];

  function normalizeDomain(value) {
    const text = String(value).trim().toLowerCase().replace(/\.$/, '');
    if (!text || /[\s/:@*?#\\]/.test(text)) return null;
    let host;
    try { host = new URL('https://' + text).hostname; } catch { return null; }
    if (!host.includes('.') || host.length > 253 || /^\d+(\.\d+){3}$/.test(host)) return null;
    if (!host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
    return host;
  }

  // Deliberately strict: never reinterpret an unsupported uBO rule as a hostname.
  function parseDomains(text) {
    if (typeof text !== 'string' || text.length > 3 * 1024 * 1024) throw new Error('List is too large (maximum 3 MiB).');
    const domains = new Set();
    const invalid = [];
    let lineNumber = 0;
    for (const line of text.split(/\r?\n/)) {
      lineNumber++;
      const value = line.trim();
      if (!value || value.startsWith('#') || value.startsWith('!')) continue;
      const domain = normalizeDomain(value);
      if (!domain) { if (invalid.length < 3) invalid.push(lineNumber); continue; }
      domains.add(domain);
      if (domains.size > MAX_DOMAINS) throw new Error('Too many domains (maximum 100,000).');
    }
    if (invalid.length) throw new Error('Expected one domain per line. Unsupported entries on line(s): ' + invalid.join(', ') + '.');
    return [...domains].sort();
  }

  function matches(hostname, domains) {
    let host = hostname.toLowerCase().replace(/\.$/, '');
    while (host) {
      if (domains.has(host)) return true;
      const dot = host.indexOf('.');
      if (dot < 0) break;
      host = host.slice(dot + 1);
    }
    return false;
  }

  function settingsFrom(input = {}) {
    const result = {...DEFAULTS};
    for (const key of ['enabled', 'blockBlank', 'strict']) {
      if (typeof input[key] === 'boolean') result[key] = input[key];
    }
    for (const key of ['siteAllowlist', 'destinationAllowlist', 'customBlocklist']) {
      if (typeof input[key] === 'string') result[key] = input[key];
      parseDomains(result[key]);
    }
    if (typeof input.sourceUrl === 'string') {
      const url = new URL(input.sourceUrl);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('List URL must be HTTPS without credentials or a fragment.');
      result.sourceUrl = url.href;
    }
    return result;
  }

  function createMatcher(domainList, input, topHostname = '') {
    const settings = settingsFrom(input);
    const blocked = new Set([...SEEDS, ...domainList, ...parseDomains(settings.customBlocklist)]);
    const allowed = new Set(parseDomains(settings.destinationAllowlist));
    const sites = new Set(parseDomains(settings.siteAllowlist));
    return Object.freeze({
      check(rawUrl, baseUrl, target = '_blank', kind = 'script') {
        if (!settings.enabled || matches(topHostname, sites)) return false;
        // _self, _parent, and _top do not ask for a new browsing context.
        if (['_self', '_parent', '_top'].includes(target.toLowerCase())) return false;
        let url;
        try { url = new URL(rawUrl, baseUrl); } catch { return false; }
        if (matches(url.hostname, allowed)) return false;
        if (settings.strict && kind === 'script') return true;
        if (rawUrl.trim() === '' || (url.protocol === 'about:' && url.pathname === 'blank')) return settings.blockBlank;
        if (!['https:', 'http:'].includes(url.protocol)) return false;
        return matches(url.hostname, blocked);
      },
    });
  }
  globalThis.PopupPrevention = Object.freeze({DEFAULTS, DEFAULT_SOURCE, SEEDS, MAX_DOMAINS,
    normalizeDomain, parseDomains, matches, settingsFrom, createMatcher});
})();
