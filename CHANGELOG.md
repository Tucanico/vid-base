# Changelog — VidBase

All notable changes will be documented here. Entries are ordered newest first; each entry is dated (with `HH:MM` when known) and tagged with a [Conventional Commits](https://www.conventionalcommits.org/) prefix. Release entries carry a "What's new" body; the technical changes that landed in the release appear as individual entries above the release marker. Commit SHAs are noted at the end of the entry where known. History before 2026-10-13 is in `git log`.

**Update rule:** add an entry after every medium-to-big change. Multiple small changes that accumulate into a medium change get a single combined entry. Tiny isolated tweaks (typo fixes, single-line lint cleanups) don't need their own entry. If in doubt, write the entry — the changelog is the most accurate "what's actually shipped" record.

<!-- Template — copy and paste at the top under the first `---`:

## YYYY-MM-DD HH:MM — type(scope): one-line summary

Body paragraph describing the change. Reference files with [path](path) links. Explain the *why* alongside the *what* — surprising constraints, race-conditions, references to the gotcha that prompted the change. Multiple entries from the same commit share the timestamp + SHA.

`<short-sha>`

Conventional Commits types in use: `feat`, `fix`, `refactor`, `perf`, `build`, `ci`, `docs`, `test`, `chore`.

Release entries use this shape instead:

## YYYY-MM-DD — release(X.Y.Z): one-line release headline

What's new in X.Y.Z

- Bullet 1 — user-facing language, no implementation detail.
- Bullet 2.

If commit/time are unknown (old entries, manual notes, not committed yet), just omit them and use `## YYYY-MM-DD — type(scope): summary` with no SHA line.
-->

---

## 2026-10-13 — fix(library): library.json is saved atomically and an unreadable one is kept instead of overwritten

`saveLibrary` ([library.ts](src/main/VideoMode/metadata/library.ts)) wrote `library.json` in place, which empties the file before writing it, so an external drive disconnecting mid-save left a half-written file. The next load could not parse it, treated the library as missing, and the next save rebuilt it from the scanned files alone, dropping every category and tag no current video used. Saves now go to `library.json.tmp`, are flushed to the drive, and are renamed over `library.json`, so the file is always either the old or the new version. An unreadable `library.json` (invalid JSON or not the `{ files, categories, tags }` shape) is moved to `library.corrupt-<timestamp>.json` before the library is rebuilt; if it cannot be moved, the load fails instead of returning `null`, so nothing gets overwritten.

## 2026-10-13 — chore: line endings are LF everywhere

The working copy had been checked out with CRLF while the repo stores LF, and both Prettier configs (`.prettierrc.yaml` and the `prettier/prettier` options in [eslint.config.mjs](eslint.config.mjs)) asked for CRLF, so on Linux `npm run lint` failed on every line and `npm run format` would have rewritten every file. Both now say `lf`, and [.gitattributes](.gitattributes) (`* text=auto eol=lf`) keeps checkouts LF on Windows too. Also adds [CLAUDE.md](CLAUDE.md) and this changelog.

## 2026-10-13 10:23 — chore(deps): refresh package-lock

Lockfile refresh within the existing `package.json` ranges (no direct dependency changed): electron 39.2.7 → 39.8.6, electron-builder 26.5 → 26.8, vitest 4.0 → 4.1, typescript-eslint 8.51 → 8.58 and their transitive dependencies.

`0055fcc`

## 2026-10-13 10:10 — feat(drive): keep external drives awake and retry transient I/O errors

Libraries on external drives failed when the drive had spun down. [driveKeepAlive.ts](src/main/driveKeepAlive.ts) stats the open library folder every 30 s (started when a folder is picked or movie mode loads, stopped on quit). The load/save/scan/tag-update/movie-load IPC handlers in [index.ts](src/main/index.ts) go through `withRetry`: up to 3 attempts with exponential back-off (2 s, 4 s) on `EIO`/`EAGAIN`/`EBUSY`/`ETIMEDOUT`/`EREMOTEIO`. For the retries to see those errors, `loadLibrary` now rethrows filesystem errors other than `ENOENT` instead of returning `null` (which also stopped a failed read from looking like "no library" and getting `library.json` overwritten), and `saveLibrary` rethrows after logging.

`1d0b127`

## 2026-10-13 10:10 — fix(linux): run on X11 to avoid the Wayland crash

Electron's Wayland (Ozone) backend segfaults during window creation on current Mutter releases (Ubuntu 25.10+). The backend is picked before the main script runs, so `app.commandLine.appendSwitch` is too late and has to come from Electron's command line: [electron.vite.config.ts](electron.vite.config.ts) passes `--ozone-platform=x11` through `ELECTRON_CLI_ARGS` for `npm run dev` (`VIDBASE_OZONE_PLATFORM=wayland` opts back in), and [electron-builder.yml](electron-builder.yml) adds it to the packaged launcher with `StartupWMClass: VidBase`. The same commit unpacks the ffmpeg, ffprobe and exiftool binaries from the asar, drops the snap target, and sets the Linux maintainer and the AudioVideo category.

`ddaa6b0`
