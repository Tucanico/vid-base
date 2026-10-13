# VidBase — agent guide

Electron desktop catalog for video and movie libraries, built with electron-vite + React + TypeScript and packaged for Windows, macOS and Linux. **Video Mode** scans a folder recursively, reads tags from the files' metadata with ExifTool, makes thumbnails with FFmpeg, and keeps `library.json` + `.thumbnails/` next to the media. **Movie Mode** is an Excel-backed catalog with optional TMDb enrichment. Libraries often live on external drives. Stack details and setup are in [README.md](README.md).

---

## Architecture in one paragraph

- **Main process** ([src/main/](src/main/)): [index.ts](src/main/index.ts) registers every IPC handler. Drive resilience: `withRetry` / `isTransientDriveError` in [driveRetry.ts](src/main/driveRetry.ts), keep-alive in [driveKeepAlive.ts](src/main/driveKeepAlive.ts). Video Mode logic is in `VideoMode/metadata/` (`library.ts` load/save, `scanner.ts`, `cleanup.ts`, `thumbnails.ts`, `updateTags.ts`). Movie Mode is in `MovieMode/metadata/`: `movieParser.ts` (the load entry points), `movieFolders.ts` (folder walk), `archiveWriter.ts` (Excel updates), `excelValues.ts`, `folderNames.ts`, `tmdb.ts`. The shared ExifTool instance is in `metadata/utils.ts`.
- **Preload** ([src/preload/](src/preload/)) exposes `window.api`, one file per mode plus `shared.ts`.
- **Renderer** ([src/renderer/src/](src/renderer/src/)): [App.tsx](src/renderer/src/App.tsx) shows the mode selection, then `components/VideoMode/VideoModeView.tsx` or `components/MovieMode/MovieModeView.tsx`, which own that mode's state. Shared list state in `hooks/`, shared list chrome in `components/` (`AppHeader`, `ListLayout`, `ScanLoader`, `EmptyMessage`), pure list logic in `utils/videoList.ts` / `utils/movieList.ts`.
- **Shared types** in [src/shared/types/](src/shared/types/). Standalone Node scripts in [src/scripts/](src/scripts/).

---

## Hard rules

1. **Conventional Commits, lowercase** (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `build:`, etc., optional scope). Commits before 2026-10-13 use capitalised `Feat:` / `Fix:`; don't copy that. **Don't commit or push yourself.** At the end of every slice, emit a copy-pasteable git block in this exact shape:
   ```
   git add .
   git commit -m "<conventional-commits one-liner>"
   git push
   ```
   No `cd` line — the user is already inside the repo. Label it `**vidbase:**`. The block must be pure copy-paste with no surgery: `git add .` (not specific files), one-line `-m` (no heredoc, no multi-paragraph body), no `Co-Authored-By` footer.
2. **Update [CHANGELOG.md](CHANGELOG.md) after every medium-to-big change.** Multiple small changes that accumulate into a medium change get one combined entry; tiny isolated tweaks don't need one. Entry shape is documented at the top of the file — `## YYYY-MM-DD HH:MM — type(scope): summary`, a body paragraph, the short SHA on its own line (omitted until committed). Newest first. Release cuts get a `release(X.Y.Z)` entry with a user-facing "What's new" list. If in doubt, write the entry. **After every changelog update, output a single-line Conventional-Commits commit message** for the change, using the single most representative type/scope.
3. **Line endings are LF.** Prettier's options live in two places that must stay identical: [.prettierrc.yaml](.prettierrc.yaml) and the `prettier/prettier` rule options in [eslint.config.mjs](eslint.config.mjs). [.gitattributes](.gitattributes) enforces LF on checkout.
4. **`library.json` and the tag format are contract with users' existing libraries and files.** `library.json` is `{ files, categories, tags }` (type in [src/shared/types/library.ts](src/shared/types/library.ts)). Tags are written into the video files by [updateTags.ts](src/main/VideoMode/metadata/updateTags.ts) as `key:value; simple; fav` across XPKeywords/Keywords/Subject/Category/Description/Comment, and parsed back by `parseTagsWithFavorite` in [scanner.ts](src/main/VideoMode/metadata/scanner.ts). Same for the Excel layout Movie Mode reads and creates. Don't rename fields or change the format without a read-old / write-new migration.

---

## Sensitive areas — read the file's comments before editing

- **[library.ts](src/main/VideoMode/metadata/library.ts) `loadLibrary` / `saveLibrary`.** `loadLibrary` returns `null` only when `library.json` is missing (`ENOENT`); an unreadable one is moved to `library.corrupt-<timestamp>.json` first, and any other filesystem error is thrown. Callers treat `null` as "no library" and the next save rebuilds it, so returning `null` on an I/O error silently loses categories and tags. `saveLibrary` writes `library.json.tmp`, fsyncs, and renames it over `library.json`; never write `library.json` in place.
- **`withRetry` in [driveRetry.ts](src/main/driveRetry.ts)** reruns the whole IPC handler body on a retryable error code, including `cleanupOrphans` and the scan, so handler bodies must stay safe to run twice. Only errors that reach it are retried: code that catches filesystem errors to carry on must rethrow `isTransientDriveError` ones.
- **Movie Mode deletes and creates Excel data.** `parseMovieExcel` ([movieParser.ts](src/main/MovieMode/metadata/movieParser.ts)) deletes the rows of movies whose folder it did not find, and `movies:load` creates a new `Archivio.xlsx` when `findExcelFile` returns `null`. Anything that makes a folder look missing or an archive look absent on a drive error deletes or overwrites the user's catalog, which is why the walk in [movieFolders.ts](src/main/MovieMode/metadata/movieFolders.ts) and `findExcelFile` rethrow transient drive errors.
- **The mode views load the picked folder in their first effect**, behind a ref ([VideoModeView](src/renderer/src/components/VideoMode/VideoModeView.tsx), [MovieModeView](src/renderer/src/components/MovieMode/MovieModeView.tsx)). StrictMode runs effects twice in development; without the ref two scans run at once and race on `library.json`.
- **[cleanup.ts](src/main/VideoMode/metadata/cleanup.ts) `cleanupOrphans`** runs before every scan and trashes thumbnails and drops library entries whose file is not on disk. Anything that makes a file look missing (an error treated as "not found") deletes user data.
- **Native binaries in the packaged app.** `ffmpeg-static`, `ffprobe-static` and `exiftool-vendored.pl` / `.exe` must stay in `asarUnpack` in [electron-builder.yml](electron-builder.yml), and the code must rewrite `app.asar` → `app.asar.unpacked` in their paths (see [thumbnails.ts](src/main/VideoMode/metadata/thumbnails.ts)). A new native binary needs both, or it works in dev and fails only when packaged.
- **Linux runs on X11.** Electron's Wayland backend segfaults on current Mutter (Ubuntu 25.10+). The switch must be on Electron's command line, because the backend is chosen before the main script runs (`app.commandLine.appendSwitch` is too late): `ELECTRON_CLI_ARGS` in [electron.vite.config.ts](electron.vite.config.ts) for dev, `executableArgs` in [electron-builder.yml](electron-builder.yml) for packaged builds. `VIDBASE_OZONE_PLATFORM=wayland` opts back in for dev.

---

## Soft rules / strong preferences

- When fixing a bug, keep the diff minimal; don't sweep adjacent code unless the task says so.
- Comments explain _why_ — constraints, the gotcha that prompted a line — not what the code does. Functions keep the existing JSDoc shape (`/** summary` + `@param` / `@returns`).

---

## Build / test commands that work

- `npm run typecheck` — main/preload and renderer TypeScript
- `npm test` — Vitest suite (`src/**/*.test.ts`). CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs typecheck, lint and tests on every push
- `npm run lint` — ESLint + Prettier
- `npm run dev` — run the app with hot reload (X11 on Linux, see above)
- `npm run build:linux` — AppImage + deb into `dist/`; `npm run build:win` / `npm run build:mac` for the other platforms

---

## Project state files

- [CHANGELOG.md](CHANGELOG.md) — running history, newest first. Keep it current per hard rule #2. When uncertain whether something is done, grep it first, then `git log`.
- [README.md](README.md) — setup, TMDb key, build and log locations.

---

## Things to never do

- Commit, push, or merge yourself — give the git block (hard rule #1).
- Skip git hooks (`--no-verify`) without explicit user instruction.
- Change `library.json`'s shape or the tag format without a migration (hard rule #4).
- Switch line endings back to CRLF, or change one Prettier config without the other (hard rule #3).
