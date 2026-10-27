# Contributing

Start with an issue containing a reproducible popup or breakage report. Include the public page URL, exact click or action, chosen player/server, browser version, full uBlock Origin version, and enabled additional blockers. State whether disabling this list changes the behavior.

Open uBlock's logger before reproducing the issue. Share only the relevant frame, popup, script, and scriptlet entries. Remove query tokens, cookies, IP addresses, email addresses, account identifiers, and unrelated browsing data. A hostname and URL path are usually enough. Never attach the original unredacted log.

## Adding a fix

1. Identify the frame and code that creates the popup. Blocking only the ad destination may leave the tab flicker.
2. Scope the filter to confirmed site/player domains and a sufficiently specific script signature. Do not introduce global `##+js(...)` rules or globally disable clicks or JavaScript.
3. Verify the rule is applied in the logger. Check that the popup no longer opens and that playback, fullscreen, seeking, subtitles, and server switching still work. For a recurring overlay, wait through its recurrence interval and test again.
4. Record the exact browser, uBlock version, test date, and result in the pull request. Distinguish user-confirmed behavior from source inspection or synthetic checks.
5. Add a short explanatory comment to `filters.txt`, update its Version and Last modified headers, and add a changelog entry.
6. Run validation. Keep third-party source and user logs out of the repository.

Prefer a narrow script abort over blanket popup suppression when both are effective. Cosmetic overlay hiding should accompany a script fix when needed; it is not evidence that the popup script has stopped executing.

## Syntax validation

Requires Node.js 22 or newer, Git, and an internet connection for the initial upstream checkout:

```sh
git clone --no-checkout https://github.com/gorhill/uBlock.git /tmp/popup-prevention-ublock
git -C /tmp/popup-prevention-ublock checkout --detach "$(cat tools/ublock-revision.txt)"
node tools/validate.mjs /tmp/popup-prevention-ublock
```

The validator uses uBlock Origin's actual static filter parser at the pinned revision. It also rejects duplicate, unscoped, and unknown-scriptlet rules and checks the release headers. It does not execute arbitrary contributed scripts or claim that a live website is fixed. GitHub Actions runs the same validation for pushes and pull requests.

To update the parser pin, review an upstream commit, replace `tools/ublock-revision.txt` with its full commit SHA, and run validation again. Upstream code is not redistributed with this project.

## Publishing

The subscription follows `filters.txt` on the `main` branch. Merge only verified changes. uBlock Origin handles subscriber downloads according to its update schedule and the list's `Expires` header. No additional hosting service or scheduled job is required.
