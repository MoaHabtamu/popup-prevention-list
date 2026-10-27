# Streaming-site popup audit — October 27, 2026

## Scope and environment

Seven supplied home-page URLs were opened in Codex's Chromium-based in-app browser. One title was sampled per reachable site, with attempts to select each exposed top-level server and inspect nested server menus. This was **not an Opera + uBlock Origin test**: the available browser does not share the user's extension installation or subscription. Consequently, these observations establish popup sources, playback results, and candidate fixes, but do not establish that the subscription eliminates flicker on these sites.

No CAPTCHA was completed and no verification overlay was bypassed. A server that failed to load, a click intercepted by an ad overlay, or a player whose timer did not advance is not a passing playback or popup-regression test. Playback controls briefly displaying Pause were insufficient: several such players later sampled at zero seconds, paused.

## Top-level results

| Supplied site | Sample | Server choices attempted | Observations |
| --- | --- | --- | --- |
| `ww4.seeflix.to/home/` | Redirected to MooPlay; sampled `/from/`, S1 E1 | VidSrc, Filemoon, VidPlay | Home page redirects to `ww1.mooplay.cc/`. Player clicks and server changes opened ad tabs without the user's blockers. VidSrc loads the already-covered Play.Netwara/Netwara chain; Filemoon initially produced a blank embedded page; VidPlay loads Videasy. Full playback on every server was not confirmed. |
| `ww8.123moviesfree.net/home/` | `/movie/obsession-2415/` | Server 1, Server 2, Server 3 | Uses `ployan.me` wrappers. Server 2 loaded Emboser, initially connected to a Vidsrc player, then changed to an Emboser 404. Servers 1 and 3 ultimately used `vxcagb.com`. Play was requested; a transient Pause state was observed on Server 1, but later sampled media was paused at zero. No clean playback pass is claimed. |
| `fmoviess.org/home/` | `/film/obsession-2415/` | Server 1, Server 2, Server 3 | Uses `netoda.tech` wrappers. Server 2 reached the same Emboser 404; Servers 1 and 3 reached `vxcagb.com`. A keyboard action was needed to confirm Server 1 selection after an earlier pointer click did not activate it. Server 3 briefly reported Pause, then buffering and paused media at zero. |
| `m4uhdnow.net/home.html` | `/watch-movie-street-fighter-1994-3771.html` | #M, #H, #BackUp | Server-selection clicks opened ad tabs. #M loaded `if6.ppzj-youtube.cfd` with no usable controls in the inspected frame. #H loaded `abyssplayer.com` with JW Player and movie duration; playback could not be reliably started through the available iframe input controls. #BackUp loaded `vidsrc.sh` → `stellarconductornexus.com`; keyboard Play advanced into the inner player. Sustained playback was not confirmed. |
| `ww2.yesmovies.ag/yes.html` | `/movie/obsession-2415.html` | Server 1, Server 2, Server 3 | Uses `ployan.me` wrappers. Server 1 loaded `vxcagb.com` and briefly reported Pause after Play; Server 2 loaded the Emboser route; Server 3 again loaded `vxcagb.com`. Full playback and popup-free operation were not established for every choice. |
| `fmovies-watch.com/home/` | `/the-bad-guys-2/` | Server 1, Server 2, Server 3, Server 4 | An anonymous invisible full-page div with maximum z-index repeatedly intercepted Play/server clicks and opened ad tabs. Attempts to click each server did not reliably change the active selection. The four destinations were therefore also inspected directly, as detailed below. This is not a successful four-server in-page playback test. |
| `yoyomovies.net/home/` | `/obsession-2/` | VidEasy, CineWave, Vidnest | Automatic Cloudflare checks resolved. VidEasy eventually displayed a provider-level media-not-found error. CineWave (`vidsrc.su`) played successfully in a direct embed test; its timer advanced past 00:14 and subsequently past 03:00. Vidnest loaded media metadata and a server menu control, but a verification-style `about:srcdoc` overlay appeared when Play was attempted. All nested Vidnest providers were not tested. |

## Additional player checks

### FMovies Watch destinations

Destinations were read from the public page's `Servers` configuration, rather than guessed:

| Choice | Destination | Direct test |
| --- | --- | --- |
| Server 1 | `vidsrc.pro/embed/movie/tt30017619` | Connection closed; no playback test possible. |
| Server 2 | FMovies Watch's `player.php?video_id=tt30017619` | Navigation ended on a blank page. |
| Server 3 | `moviesapi.club/movie/tt30017619` | DNS resolution failed. |
| Server 4 | `vidlink.pro/movie/tt30017619` | Player UI loaded, but duration remained 0:00 and sustained playback was not confirmed. |

The page loaded `madurird.com/tag.min.js`. This is a source-investigation lead, not proof that blocking it alone resolves all observed ads. No new filter for that script is included in the candidates.

### MooPlay / Play.Netwara nested choices

The VidSrc wrapper exposed four additional choices: Netwara, Vidcore, Videasy, and Peachify. Netwara loaded through to the inner player; Vidcore selection reached a `vidcore.io` frame; Videasy selection reached `player.videasy.to`. Peachify and complete playback/control regression checks remain untested. Existing user-confirmed filters already target the wrapper and Netwara popup scripts.

### CineWave nested choices

The source menu exposed Ares, Circe, Dionysus, Eros, and Freya. Ares played with an advancing timer. Circe selection was attempted and displayed Loading; later playback was seen, but the active provider was not reliably identified. Dionysus selection was attempted; fullscreen/control-state changes prevented reliable confirmation. Eros and Freya remain untested. These results must not be represented as an all-provider pass.

## Specific popup mechanisms found

### Vidsrc.sh: clean-frame popup bundle

The inspected Vidsrc.sh inline script contains both `window.open` and `shown_at`, and falls back to a temporary frame's `contentWindow.open` if the original function appears modified. This matches the mechanism already targeted on Netwara. A scoped candidate extends that proven script signature to `vidsrc.sh`.

### Vxcagb.com: rotating popup destinations

The same inline script was inspected in live Vxcagb frames reached from 123MoviesFree, Fmoviess, and YesMovies. It declares `mergedPopups`, registers a document click handler, and calls `window.open` with rotating ad destinations and a 30-second per-destination delay. A candidate aborts that specific inline script at its `document.addEventListener` access, before the handler registers. This avoids suppressing unrelated player event handlers.

The presence of the source establishes a popup trigger, not successful reproduction of tab flicker with full uBlock. Other external ad scripts were present, so these candidates cannot establish complete popup coverage.

## Candidate validation and release status

The rules in `candidates/streaming-players.txt` are deliberately excluded from the public `filters.txt` subscription. They require a live full-uBlock test before activation. Parser validation establishes syntax only. The [October 28 follow-up](2026-10-28-follow-up.md) records additional provider checks and a third candidate.

To promote either rule, reproduce with the subscription enabled in Opera/full uBlock, confirm the candidate is injected and aborts its intended script in the logger, check that no new tab is created, and verify playback, seeking, fullscreen, subtitles, and server switching. Repeat beyond the popup's recurrence interval.

No raw user logs, signed player URLs, query tokens, IP addresses, or downloaded site source are included in this report.
