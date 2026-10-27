/* Runs in MAIN at document_start. Does not create or close browser tabs. */
(() => {
  'use strict';
  const CHECK = 'popup-prevention:check:v1';
  const dispatch = EventTarget.prototype.dispatchEvent;
  const CustomEventCtor = CustomEvent;
  const stringify = JSON.stringify;
  const apply = Reflect.apply;
  const getDescriptor = Object.getOwnPropertyDescriptor;
  const define = Object.defineProperty;
  const patched = new WeakSet();
  const canceled = getDescriptor(Event.prototype, 'defaultPrevented').get;

  function denied(url, base, target, kind) {
    const event = new CustomEventCtor(CHECK, {
      cancelable: true, detail: stringify({url, base, target, kind}),
    });
    apply(dispatch, document, [event]);
    return apply(canceled, event, []);
  }

  function baseFor(win) {
    try { return win.document.baseURI; } catch { return document.baseURI; }
  }

  function patchWindow(win) {
    if (!win || patched.has(win)) return;
    try {
      const nativeOpen = win.open;
      if (typeof nativeOpen !== 'function') return;
      const wrapped = new Proxy(nativeOpen, {
        apply(fn, thisArg, originalArgs) {
          const args = [...originalArgs];
          const url = args[0] === undefined ? '' : `${args[0]}`;
          const target = args[1] === undefined ? '_blank' : `${args[1]}`;
          if (denied(url, baseFor(win), target, 'script')) return null;
          // Convert only once, as Web IDL would. Preserve all other arguments.
          if (args.length > 0) args[0] = url;
          if (args.length > 1) args[1] = target;
          return apply(fn, thisArg, args);
        },
      });
      define(win, 'open', {...getDescriptor(win, 'open'), value: wrapped});
      patched.add(win);
      patchIframeGetter(win, 'contentWindow');
      patchIframeGetter(win, 'contentDocument');
    } catch { /* Cross-origin/restricted frames are handled by all_frames. */ }
  }

  function patchIframeGetter(win, name) {
    const proto = win.HTMLIFrameElement?.prototype;
    if (!proto) return;
    const descriptor = getDescriptor(proto, name);
    if (!descriptor?.get || !descriptor.configurable) return;
    const original = descriptor.get;
    define(proto, name, {...descriptor, get() {
      const result = apply(original, this, []);
      try { patchWindow(name === 'contentWindow' ? result : result?.defaultView); } catch {}
      return result;
    }});
  }

  function resolvedTarget(element) {
    return element.getAttribute('target') || document.querySelector('base[target]')?.getAttribute('target') || '';
  }
  function opensNew(target, modified) {
    return modified || (!!target && !['_self', '_parent', '_top'].includes(target.toLowerCase()));
  }
  function onLink(event) {
    if (event.type === 'auxclick' && event.button !== 1) return;
    if (event.type === 'click' && event.button !== 0) return;
    const path = event.composedPath();
    const anchor = path.find(node => node?.localName === 'a' || node?.localName === 'area');
    if (!anchor?.hasAttribute('href') || anchor.hasAttribute('download')) return;
    const target = resolvedTarget(anchor);
    const modified = event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1;
    if (!opensNew(target, modified)) return;
    if (denied(anchor.href, document.baseURI, modified ? '_blank' : target, 'link')) event.preventDefault();
  }

  function formDenied(form, submitter) {
    const target = submitter?.hasAttribute('formtarget') ? submitter.getAttribute('formtarget') : resolvedTarget(form);
    if (!opensNew(target, false)) return false;
    // A submit button may override the form action.
    const action = submitter?.hasAttribute('formaction') ? submitter.formAction : form.action;
    return denied(action || document.URL, document.baseURI, target, 'form');
  }
  document.addEventListener('click', onLink, true);
  document.addEventListener('auxclick', onLink, true);
  document.addEventListener('submit', event => {
    if (formDenied(event.target, event.submitter)) event.preventDefault();
  }, true);
  const formProto = globalThis.HTMLFormElement?.prototype;
  if (formProto && typeof formProto.submit === 'function') {
    const descriptor = getDescriptor(formProto, 'submit');
    define(formProto, 'submit', {...descriptor, value: new Proxy(descriptor.value, {
      apply(fn, form, args) {
        if (formDenied(form, null)) return;
        return apply(fn, form, args);
      },
    })});
  }
  patchWindow(window);
})();
