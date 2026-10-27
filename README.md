# Popup Prevention

**Experimental generic extension:** [install and use the browser extension](extension/README.md) to check popup-ad destinations across websites before they open. It includes a shared, auto-updating popup-ad domain list and exceptions. The existing uBlock filter subscription below remains available separately.

A small community filter list for **full uBlock Origin**, focused on stopping ad-popup scripts before they create tabs and cause an open/close flicker.

The first release contains the configuration confirmed to fix MooPlay's embedded player in Opera on October 27, 2026. It is a starting point for collecting reproducible fixes, not universal popup coverage.

## Install

1. Open uBlock Origin's dashboard (toolbar icon → gear).
2. Select **Filter lists** → **Custom** → **Import**.
3. Paste this URL:

   ```text
   https://raw.githubusercontent.com/MoaHabtamu/popup-prevention-list/main/filters.txt
   ```

4. Click **Apply changes**, then reload the affected website.

Keep uBlock Origin's default lists and **Auto-update filter lists** enabled. The list requests a daily refresh; uBlock schedules updates, so changes are not delivered instantly. You can also open [the raw filter list](https://raw.githubusercontent.com/MoaHabtamu/popup-prevention-list/main/filters.txt), copy its contents into **My filters**, and apply changes, but a pasted copy will not receive updates automatically.

Once the subscription is working, you may remove duplicate rules previously pasted into My filters. Use one content-blocking extension; uBlock's developer [recommends against combining it with other content blockers](https://github.com/gorhill/uBlock#all-programs).

## Coverage

| Target | What the filters do | Evidence |
| --- | --- | --- |
| `mooplay.cc` and subdomains | Prevent `window.open()` calls; hide the known player-wrapper ad overlay | Part of the configuration confirmed working in Opera |
| `netwara.xyz` and subdomains | Abort the specific popup bundle containing `shown_at` when it accesses `window.open` | uBlock logger recorded the script being aborted |
| `play.netwara.xyz` and subdomains | Abort the `geniusdexchange.com` ad script before it installs click handlers; hide its overlay | Logger identified this frame; user confirmed the flicker stopped after these two rules were added |

Rules for the player domains also apply when other websites embed those same domains. That reuse does not establish that every embedding website has been tested. New ad providers, domains, or rewritten scripts need new evidence and filters.

The list does not block all popups on every website. A blanket rule can also stop sign-in windows, payments, downloads, and deliberate new-tab links. This project adds scoped rules for confirmed ad mechanisms instead.

## Compatibility and troubleshooting

Use **full uBlock Origin** in a browser that supports it. The `[Adblock Plus 2.0]` header identifies the filter-list format; the scriptlet rules require uBlock Origin. Adblock Plus, DNS blockers, hosts files, and network firewalls cannot apply these scriptlets. uBlock Origin Lite and other blockers are not validated targets for this list.

If a site breaks, temporarily uncheck **Popup Prevention** in Filter lists, click Apply changes, and reload. If that resolves the problem, [report the breakage](https://github.com/MoaHabtamu/popup-prevention-list/issues/new/choose). The MooPlay rule intentionally prevents all scripted popups on that domain, including legitimate ones.

If the flicker remains, open uBlock's logger before reproducing it. A `$popup` entry alone usually identifies a tab being handled after creation; a fix here aims to neutralize its trigger earlier. See [uBlock's logger guide](https://github.com/gorhill/uBlock/wiki/The-logger).

## Help expand coverage

[Report a popup or broken page](https://github.com/MoaHabtamu/popup-prevention-list/issues/new/choose), or submit a pull request following [CONTRIBUTING.md](CONTRIBUTING.md). Include the affected page, trigger, player/server, browser and extension versions, and a small redacted logger excerpt. Do not upload full browsing logs, cookies, access tokens, or private account URLs.

The project has no background monitoring service. Updates reach subscribers after maintainers review and merge new filters.

## Validation and license

Run the upstream-parser check described in [CONTRIBUTING.md](CONTRIBUTING.md). Syntax checks do not prove live-site behavior; keep reproduction notes and test playback and controls for each change.

Original code, filters and project documentation are available under the [MIT license](LICENSE). The extension's bundled HaGeZi data retains its [GPL-3.0 license](extension/data/GPL-3.0.txt); see [its provenance](extension/data/source.json). uBlock Origin's parser is fetched separately for validation and retains its own license.

References: [importing and updating filter lists](https://github.com/gorhill/uBlock/wiki/Dashboard:-Filter-lists), [uBlock's scriptlet documentation](https://github.com/gorhill/uBlock/wiki/Resources-Library).
