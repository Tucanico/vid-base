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

## 2026-10-13 — feat(movies): ask before replacing an existing Archivio.xlsx

When `findExcelFile` finds no archive, `movies:load` builds a new `Archivio.xlsx` from the movie folders. If one already exists (the folder could not be listed, so it was missed), [createMovieArchivioFromFolders](src/main/MovieMode/metadata/movieParser.ts) now asks first through a popup from [index.ts](src/main/index.ts): **Keep and load it** (the default) loads the existing file, **Replace it** builds the new one; without a TMDb key no new archive can be built, so the existing one is kept without asking. Keeping it would still have emptied it, because the same unreadable folder left every movie unmatched and unmatched movies are deleted: an error reading the movies root now skips folder matching instead ([movieFolders.ts](src/main/MovieMode/metadata/movieFolders.ts)), so the movies load without their folders and the file is left alone. Tests in [movieParser.test.ts](src/main/MovieMode/metadata/__tests__/movieParser.test.ts) and [movieDriveErrors.test.ts](src/main/MovieMode/metadata/__tests__/movieDriveErrors.test.ts), which also cover the drive-error handling of the previous commit.

## 2026-10-13 — build(ts): tsconfig.web.json no longer uses options TypeScript 6 deprecates

VS Code (TypeScript 6) flagged `baseUrl` in [tsconfig.web.json](tsconfig.web.json); the project's TypeScript 5.9 does not. `baseUrl` only served nine type imports written `'src/shared/types/...'`, which now use the `@shared/...` alias like the rest of the renderer, and the `paths` entries start with `./`, which is required without `baseUrl`. `downlevelIteration`, also deprecated, is gone: it has no effect with `target: ES2020`. Both tsconfigs typecheck with TypeScript 5.9 and 6.0. The `ignoreDeprecations: "6.0"` the message suggests is rejected by TypeScript 5.9.

## 2026-10-13 11:43 — fix(movies): a drive error no longer deletes rows from the Excel archive or overwrites it

`parseMovieExcel` deletes the Excel rows of the movies whose folder it did not find. The folder walk ([movieFolders.ts](src/main/MovieMode/metadata/movieFolders.ts): `searchMovieFoldersRecursively`, `folderContainsVideo`, `findUnmatchedMovieFolders`, `calculateFolderSize`) caught and skipped every error, so a folder that could not be read while the drive was waking up left its movies unmatched, and their rows were deleted. `findExcelFile` returned `null` on any error, after which `movies:load` created a new `Archivio.xlsx` from the folders, overwriting the existing one with its LQ / CHECK / NOTE columns. All of them now rethrow transient drive errors (`isTransientDriveError` in [driveRetry.ts](src/main/driveRetry.ts), the codes `withRetry` retries), so the load is retried and nothing is written unless the scan completed; other errors (e.g. `EACCES` on a system folder) are skipped as before.

`ec94ae3`

## 2026-10-13 11:43 — fix(logs): renderer errors reach main.log, and info messages keep reaching it once the user .env is loaded

The renderer logs through electron-log ([main.tsx](src/renderer/src/main.tsx)), which needs `log.initialize()` in the main process before its messages are written to the file; it was never called, so renderer errors only reached DevTools. And `loadEnvFile` in [index.ts](src/main/index.ts) hid dotenv's output by patching `console.log` / `console.info` and then restoring the functions saved at startup, which undid the wrapping that writes them to the log file whenever the user `.env` was loaded (the packaged app with a TMDb key). It now passes dotenv's `quiet` option instead.

`ec94ae3`

## 2026-10-13 11:43 — refactor: App.tsx and movieParser.ts are split by mode and by job

[App.tsx](src/renderer/src/App.tsx) held the state of both modes in 1,659 lines; it now only shows the mode selection, and [VideoModeView](src/renderer/src/components/VideoMode/VideoModeView.tsx) / [MovieModeView](src/renderer/src/components/MovieMode/MovieModeView.tsx) own their mode's state. They share the filter, search and sort state ([useListControls](src/renderer/src/hooks/useListControls.ts)), the scroll restore ([useListScrollRestore](src/renderer/src/hooks/useListScrollRestore.ts)) and the list chrome (`AppHeader`, `ListLayout`, `ScanLoader`, `EmptyMessage`); the pure list logic is in [videoList.ts](src/renderer/src/utils/videoList.ts) and [movieList.ts](src/renderer/src/utils/movieList.ts). The picked folder is now loaded by the mode view's first effect, behind a ref so StrictMode's second run in development does not start a second scan. [movieParser.ts](src/main/MovieMode/metadata/movieParser.ts) (1,325 lines) keeps the three load entry points; cell values moved to `excelValues.ts`, folder-name matching to `folderNames.ts`, the folder walk to `movieFolders.ts`, TMDb to `tmdb.ts`, and the Excel update to `archiveWriter.ts`. No behaviour change: every moved function compares identical to the previous commit, and an end-to-end run of both modes (scan, search, sort, favourites, tag filters, detail views, type tabs, duration range, folder re-pick, Excel additions and deletions) gave identical results.

`ec94ae3`

## 2026-10-13 11:43 — build(ci): tests for drive retry, library load/save and tag parsing; CI on every push

`withRetry` moved from `index.ts` to [driveRetry.ts](src/main/driveRetry.ts) so it can be tested. New suites: [driveRetry.test.ts](src/main/__tests__/driveRetry.test.ts), [library.test.ts](src/main/VideoMode/metadata/__tests__/library.test.ts) (missing, truncated and wrong-shape files, filesystem errors thrown, no temp file left) and [scanner.test.ts](src/main/VideoMode/metadata/__tests__/scanner.test.ts) (the tag format). [ci.yml](.github/workflows/ci.yml) runs typecheck, lint and tests on every push and pull request. `build:mac` and `build:linux` now go through `npm run build`, so they typecheck like `build:win`. The README gives the data-folder paths for Linux and macOS (`vidbase`, lowercase: the packaged app has no `productName`), says logs go to one `main.log`, and explains the X11 default on Linux.

`ec94ae3`

## 2026-10-13 10:33 — fix(library): library.json is saved atomically and an unreadable one is kept instead of overwritten

`saveLibrary` ([library.ts](src/main/VideoMode/metadata/library.ts)) wrote `library.json` in place, which empties the file before writing it, so an external drive disconnecting mid-save left a half-written file. The next load could not parse it, treated the library as missing, and the next save rebuilt it from the scanned files alone, dropping every category and tag no current video used. Saves now go to `library.json.tmp`, are flushed to the drive, and are renamed over `library.json`, so the file is always either the old or the new version. An unreadable `library.json` (invalid JSON or not the `{ files, categories, tags }` shape) is moved to `library.corrupt-<timestamp>.json` before the library is rebuilt; if it cannot be moved, the load fails instead of returning `null`, so nothing gets overwritten.

`4107861`

## 2026-10-13 10:33 — chore: line endings are LF everywhere

The working copy had been checked out with CRLF while the repo stores LF, and both Prettier configs (`.prettierrc.yaml` and the `prettier/prettier` options in [eslint.config.mjs](eslint.config.mjs)) asked for CRLF, so on Linux `npm run lint` failed on every line and `npm run format` would have rewritten every file. Both now say `lf`, and [.gitattributes](.gitattributes) (`* text=auto eol=lf`) keeps checkouts LF on Windows too. Also adds [CLAUDE.md](CLAUDE.md) and this changelog.

`4107861`

## 2026-10-13 10:23 — chore(deps): refresh package-lock

Lockfile refresh within the existing `package.json` ranges (no direct dependency changed): electron 39.2.7 → 39.8.6, electron-builder 26.5 → 26.8, vitest 4.0 → 4.1, typescript-eslint 8.51 → 8.58 and their transitive dependencies.

`0055fcc`

## 2026-10-13 10:10 — feat(drive): keep external drives awake and retry transient I/O errors

Libraries on external drives failed when the drive had spun down. [driveKeepAlive.ts](src/main/driveKeepAlive.ts) stats the open library folder every 30 s (started when a folder is picked or movie mode loads, stopped on quit). The load/save/scan/tag-update/movie-load IPC handlers in [index.ts](src/main/index.ts) go through `withRetry`: up to 3 attempts with exponential back-off (2 s, 4 s) on `EIO`/`EAGAIN`/`EBUSY`/`ETIMEDOUT`/`EREMOTEIO`. For the retries to see those errors, `loadLibrary` now rethrows filesystem errors other than `ENOENT` instead of returning `null` (which also stopped a failed read from looking like "no library" and getting `library.json` overwritten), and `saveLibrary` rethrows after logging.

`1d0b127`

## 2026-10-13 10:10 — fix(linux): run on X11 to avoid the Wayland crash

Electron's Wayland (Ozone) backend segfaults during window creation on current Mutter releases (Ubuntu 25.10+). The backend is picked before the main script runs, so `app.commandLine.appendSwitch` is too late and has to come from Electron's command line: [electron.vite.config.ts](electron.vite.config.ts) passes `--ozone-platform=x11` through `ELECTRON_CLI_ARGS` for `npm run dev` (`VIDBASE_OZONE_PLATFORM=wayland` opts back in), and [electron-builder.yml](electron-builder.yml) adds it to the packaged launcher with `StartupWMClass: VidBase`. The same commit unpacks the ffmpeg, ffprobe and exiftool binaries from the asar, drops the snap target, and sets the Linux maintainer and the AudioVideo category.

`ddaa6b0`
