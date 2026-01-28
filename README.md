# VidBase Documentation

VidBase is a desktop catalog app for video and image libraries with two main workflows:
Video Mode (folder-based) and Movie Mode (Excel-driven). It scans media, reads tags,
builds a searchable library, and keeps a local cache for fast filtering.

## Features

- Video/image scanning with metadata extraction (ExifTool)
- Thumbnail generation for videos
- Tag editing and favorites
- Filters, search, and sorting
- Movie catalog from Excel + optional TMDb enrichment
- Batch edit of tags (Video Mode)
- Library cache (`library.json`) stored alongside your media

## Requirements

- Node.js (LTS recommended)
- npm
- Optional: TMDb API key for movie enrichment

## Install & Run

```bash
npm install
npm run dev
```

To preview the packaged app:

```bash
npm run start
```

## Modes

### Video Mode

1. Click **Select Video Folder** and choose a root folder.
2. VidBase scans the folder recursively and builds `library.json`.
3. Thumbnails are generated for videos and stored in `.thumbnails` directories.

#### Tag format

Tags are read from common metadata fields (e.g., Keywords, Subject, Description).
Supported tag types:

- **Simple**: `tag`
- **Key-value**: `key:value` (used to build category filters)

Favorites use the simple tag `fav` internally and are shown as **★ Favourited**.

#### Library cache

VidBase stores a cache in the selected folder:

- `library.json` (metadata, tags, categories)
- `.thumbnails/` (video thumbnails)

### Movie Mode

1. Click **Select Movies Folder**.
2. If no Excel file is present, VidBase scans movie folders and creates `Archivio.xlsx`
   using TMDb metadata (requires `TMDB_API_KEY`).
3. VidBase loads movies and optional TMDb enrichment when an API key is present.

#### TMDb API key (optional)

Create a `.env` file in the project root:

```
TMDB_API_KEY=your_api_key_here
```

## UI Overview

- **Home / Library / Favourited**: top buttons for Video Mode lists
- **Search**: filters by file name and tags (Video Mode) or fields (Movie Mode)
- **Sorting**: by name, size, duration, title, year, director
- **Batch Edit**: select multiple videos and apply tag changes

## Scanning Progress

During scans, the app shows a full-screen loader and a progress bar. Progress is
based on the number of files discovered by the recursive scan.

## Tests

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

## Build

```bash
npm run build
```

Platform builds:

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

## Troubleshooting

- **No videos found**: verify the selected folder contains supported media files.
- **Missing thumbnails**: ensure `ffmpeg-static` and `ffprobe-static` installed.
- **Movie Mode error**: confirm a valid Excel file exists in the selected folder.
- **TMDb not enriching**: check `.env` and restart the app.

## Known Limitations

- No undo/redo for tag edits or deletions.
- No built-in backup/restore for `library.json`.
- No in-app media player.
- No pagination/virtualization for large libraries.

## Data & Privacy Notes

- All metadata is stored locally in your selected folder.
- Thumbnails are generated locally and stored in `.thumbnails`.
- Movie enrichment uses TMDb if configured.
