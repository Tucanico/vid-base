# VidBase

VidBase is a desktop catalog app for video and movie libraries. It scans local folders, extracts
metadata, generates thumbnails, and builds fast filters for large collections. It also supports
an Excel-driven movie catalog with optional TMDb enrichment.

## Composition

The app is built around two workflows:

- **Video Mode**: folder-based library with tags, favorites, and batch edits.
- **Movie Mode**: Excel-backed catalog with optional TMDb enrichment and folder matching.

## Features

- Recursive scan for videos and images with metadata extraction (ExifTool).
- Thumbnail generation and local cache for fast browsing.
- Tag editing, favorites, and batch updates.
- Filter, search, and sort by fields like size, duration, title, and year.
- Excel import/update for movies with optional TMDb enrichment.
- Local-first storage: `library.json` and `.thumbnails` saved alongside your media.

## Technology

- Electron + Vite
- React + TypeScript
- ExcelJS / XLSX
- ExifTool / FFmpeg

## Setup

```bash
npm install
npm run dev
```

Preview packaged app:

```bash
npm run start
```

## TMDb API key (optional)

Dev:

Create `.env` in the project root:

```
TMDB_API_KEY=your_api_key_here
```

Packaged app:

Create `.env` with the same key in the app's data folder:

- Windows: `%APPDATA%\VidBase\.env`
- Linux: `~/.config/vidbase/.env`
- macOS: `~/Library/Application Support/vidbase/.env`

```
TMDB_API_KEY=your_api_key_here
```

## Build

```bash
npm run build:win
```

Other platforms:

```bash
npm run build:mac
npm run build:linux
```

`build:linux` produces an AppImage and a `.deb` in `dist/`.

Each build is numbered `<major>.<minor>.<number of git commits>` (e.g. `1.0.60`), so a newer `.deb` installs over an older one. The start screen shows the version running.

A video library's `library.json` stores paths relative to its folder, so the same drive works on Windows and Linux and when it is mounted somewhere else.

## Linux and Wayland

Electron's Wayland backend crashes on current GNOME releases (Ubuntu 25.10 and later), so on
Linux VidBase runs through X11 (XWayland): `npm run dev` and the packaged launcher both start it
with `--ozone-platform=x11`. To try native Wayland in development, run
`VIDBASE_OZONE_PLATFORM=wayland npm run dev`.

## Logs

Main and renderer messages are written to `logs/main.log` in the app's data folder:

- Windows: `%APPDATA%\VidBase\logs\main.log`
- Linux: `~/.config/vidbase/logs/main.log`
- macOS: `~/Library/Application Support/vidbase/logs/main.log`

## Notes

- All data remains local to your folders and user profile.
- No cloud sync, no external storage, and no telemetry.
