# Popup Prevention extension · experimental 0.1.0

A Manifest V3 extension that checks popup destinations **before calling the browser's window-opening function**. It applies on HTTP/HTTPS websites and embedded players, without maintaining a rule for every source website.

It uses [HaGeZi's Pop-Up Ads domain list](https://github.com/hagezi/dns-blocklists), plus the ad destinations observed in this project's investigation. The bundled snapshot contains 48,277 domains, retrieved October 28, 2026. The service worker checks for updates on install and once per day. Checks happen locally and synchronously; fetching a list is never part of opening a popup.

This is a standalone extension. It does **not** read uBlock Origin's enabled lists, decisions, or exceptions. Keep your usual ad blocker for network filtering. No uBlock code is bundled here.

## Install in Opera / Chrome / Edge

1. Download the project ZIP from GitHub (**Code → Download ZIP**) and extract it, or download/extract the packaged `popup-prevention-0.1.0.zip` from a successful **Test and package extension** GitHub Actions run.
2. Open `opera://extensions` (Chrome: `chrome://extensions`, Edge: `edge://extensions`).
3. Enable **Developer mode**, choose **Load unpacked**, and select the **`extension` folder containing `manifest.json`**. For the packaged ZIP, select its `popup-prevention` folder instead.
4. Reload the websites you already have open. The extension starts automatically on subsequent page loads.
5. Pin its toolbar icon if desired. Open it for a global pause switch, or choose **Settings and site exceptions**.

Requires Chromium 119+ APIs. Opera packaging/injection still needs live verification on the user's version. This package has not been submitted to a browser extension store. Firefox is not a validated target for this manifest.

## Behavior and controls

By default, only new-window destinations matching the domain list are blocked. Matching includes subdomains and checks the actual URL hostname, not words in paths/query strings. Regular same-tab navigation is preserved.

- **Window calls:** wrap `window.open` and return `null` for blocked destinations without calling the original function. No tab is created or closed by this extension.
- **Links:** cancel ad-bound new-tab links, including middle/modified clicks and links in open shadow trees, before the default navigation.
- **Forms:** check `target`, `formtarget`, and `formaction`; handle submit events and native `form.submit()`.
- **Frames:** install in matching frames, including eligible blank/srcdoc frames. Hook same-origin iframe `contentWindow` / `contentDocument` access so a common clean-frame workaround gets the patched `open` too.
- **Blank windows:** allowed by default. Turn on **Also block blank popups** if a page first opens a blank tab and navigates it later. This can affect sign-in windows, payments and downloads.
- **Strict mode:** **Block all scripted new windows** suppresses unknown scripted destinations too. Ordinary links still use the ad list. Destination exceptions take precedence.
- **Exceptions:** allow a whole source website (the main tab's hostname, including its embedded players), or allow specific destination domains. Pause protection globally from the toolbar.

Settings changes propagate to open pages. There is a brief asynchronous interval while preferences and the main tab's hostname are loaded; until then the extension allows opening calls. This preserves the user's disabled state and exceptions rather than applying an unwanted default. A page that opens windows during that interval can escape.

## Shared lists and updates

The shared list URL is configurable in Settings. It must serve plain text over HTTPS with **one domain per line**; blank lines and `#`/`!` comments are accepted. Domains apply to their subdomains too. Paste additional domains or exceptions in their separate fields.

This deliberately does not parse full uBlock/EasyList syntax. Entries such as `||ad.example^$popup`, regular expressions, hosts-file rows, paths, and scriptlets are rejected. Do not paste this repository's `filters.txt` into this field. Rejecting unsupported rules avoids silently broadening a narrow URL rule into an entire blocked domain.

Downloads have a 30-second timeout, a 3 MiB limit, and a 100,000-domain limit. Empty, malformed, redirected, oversized, or unavailable lists leave the last working copy in place. **Update list now** reports success/failure. With no successful download, the packaged list remains available offline. Changing the URL takes effect after a successful update; until then the last working list remains active.

## Limits

This is broad destination-based prevention, not a guarantee for every website:

- The destination must be available at the attempted opening call. A legitimate-looking URL that redirects to an ad later cannot be classified by its final destination in advance.
- Unknown blank popups remain possible unless the blank/strict controls are enabled.
- The initial preference-loading interval, very early iframe scripts, browser context-menu commands, browser-reserved pages, closed shadow trees for links, and deliberate replacement/bypass of the page-world hook can escape interception.
- A site may stop working when it expects a real window object but gets `null`. Use site/destination exceptions to recover.
- Domain lists can miss ads or include false positives. No claims of live playback verification across the seven audited sites are made for this extension.

The MAIN-world hook shares the page's JavaScript environment and is not a security boundary. Rules and settings remain in the extension's isolated world. A page can imitate the diagnostic event or bypass the hook; events never authorize privileged downloads or settings changes. There is no code download, `eval`, analytics, or browsing-history collection. List-host requests reveal the usual network information to that host, but include no visited-page or popup URLs.

## Build and test

No npm dependencies are required. Use Node 20+ and `zip`:

```sh
node tools/build-extension.mjs
node --test tests/extension.test.mjs
```

The build verifies the snapshot checksum, regenerates `data/bundled.js`, and produces `dist/popup-prevention-0.1.0.zip`. The snapshot, its source URL/checksum and GPL license are included in the package. Build from the repository root.

Automated tests exercise the actual interceptor and isolated bridge in separate JavaScript contexts against browser API doubles, including proof that blocked calls never reach the original function. They cover allowed calls, exceptions, blank/strict policy, fresh-frame access, links, forms, update failures and startup behavior. They do not establish browser extension injection timing; install the package for that check.

For a local manual test, run `python3 -m http.server 8765 --bind 127.0.0.1` from the repository root and open `http://127.0.0.1:8765/tests/browser/`. That fixture is for testing the production scripts' DOM behavior without installing the extension; follow the separate installed-extension checks on that page.

## License and provenance

Original extension code is [MIT](LICENSE), copyright Moa Habtamu. HaGeZi's list is **GPL-3.0**, independently attributed in [data/source.json](data/source.json), with the original source snapshot in [data/popupads.txt](data/popupads.txt) and the complete license in [data/GPL-3.0.txt](data/GPL-3.0.txt). `data/bundled.js` is a generated representation of that list and retains its GPL-3.0 license. These list files are not covered by the project's MIT license. Runtime updates remain data, not executable code.
