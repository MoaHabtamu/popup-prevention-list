# Generic popup prevention extension — October 28, 2026

Version: 0.1.0 (experimental). This is a separate implementation from the site-specific filter candidates in PR #1. The existing five-rule public filter subscription is unchanged.

## Implementation

An isolated-world matcher evaluates domain data and user preferences. The MAIN-world interception script dispatches a cancelable DOM event synchronously before calling the original `window.open`. A matching decision cancels the event; the wrapper returns `null` and never calls the original opening function. No tabs API or close-after-creation fallback is used.

The package includes a pinned HaGeZi Pop-Up Ads snapshot (48,277 entries) with original source, checksum, attribution and GPL-3.0 license. A service worker can refresh plain domain data daily. Personal domain additions, source-site exceptions, destination exceptions, global pause, blank blocking and strict scripted-window blocking are available in Settings. It does not query uBlock Origin or emulate its full filter language.

## Validation performed

- `node tools/build-extension.mjs`: verifies the list's SHA-256, parses the full snapshot, regenerates the packaged representation and builds the ZIP.
- `node --test tests/extension.test.mjs`: 12 passing tests, including parser rejection of unsupported rules; hostname boundaries; exception precedence; actual interceptor plus isolated bridge; zero native opens for blocked destinations; permitted call arguments/receiver; relative URLs and conversion; blank policy; fresh iframe access; modified/middle link clicks; forms; startup behavior; update failure/empty/malformed/oversized data; manifest packaging.
- In-app Chromium local fixture at `/tests/browser/`: nine visible PASS results for ad call suppression, zero original calls, allowed call return/count, canceled ad links, fresh iframe open, form cancellation, blank policy and destination exceptions.
- `node tools/validate.mjs /home/moaa/.cache/popup-prevention-ublock-parser`: original five-rule subscription still passes the pinned upstream parser.

The browser fixture loads the actual production scripts, but uses test browser APIs and a recording stand-in for `window.open`. The automated tests use separate JavaScript contexts for MAIN and ISOLATED, sharing a DOM-event test double. These checks prove the implementation's decision path under the tested conditions, not the real browser's extension injection lifecycle.

## Still requiring a real installed-extension check

The available in-app browser does not provide an installed copy of this unpacked extension or the user's Opera profile. Load the package in Opera and run `/tests/browser/installed.html` after adding its reserved test domain as instructed. Confirm the positive control opens, the blocked control causes no visible tab, exceptions work, and playback still works on the desired player sites.

The preference-loading interval deliberately allows opening calls; early script execution can escape. Unknown blank windows and later redirects need the optional restrictive controls or additional browser-level support. Browser menu commands, restricted pages and deliberate hook bypasses remain outside guaranteed coverage. No claim of universal zero-flicker prevention or live verification across all audited sites is made.
