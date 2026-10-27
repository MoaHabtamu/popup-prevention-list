// Test-only browser API doubles. Never included in the extension package.
globalThis.testCalls = [];
globalThis.testStorageListeners = [];
globalThis.testStored = {settings: {}, subscription: {domains: ['popup-ad.example']}};
globalThis.PopupPreventionBundled = ['popup-ad.example'];
window.open = (...args) => { testCalls.push(args); return {testWindow: true}; };
globalThis.chrome = {
  storage: {
    local: {get: async () => testStored},
    onChanged: {addListener: fn => testStorageListeners.push(fn)},
  },
  runtime: {sendMessage: async request => request.type === 'context' ? {hostname: location.hostname} : undefined},
};
