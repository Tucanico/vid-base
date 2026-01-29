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

Create `%APPDATA%\VidBase\.env` with the same key:

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

## Logs

- Main process: `%APPDATA%\VidBase\logs\main.log`
- Renderer process: `%APPDATA%\VidBase\logs\renderer.log`

## Notes

- All data remains local to your folders and user profile.
- No cloud sync, no external storage, and no telemetry.
