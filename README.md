# paneo

paneo is a keyboard-first, two-pane file manager inspired by Midnight Commander and Total Commander.
Built with Nuxt 4 + Nuxt UI, it is designed to run in Docker with filesystem access restricted to configured roots.

## Features

- Two fully independent panels
- Configurable source roots from environment variables
- File/folder operations: create, rename, copy, move, delete
- Multi-select support (keyboard + mouse)
- File viewer and text editor
- Upload with drag-and-drop and file/folder picker
- Progress tracking for copy/upload (modal + toast, minimize/cancel)
- Keyboard workflow (`Tab`, arrows, `PgUp/PgDn`, `Enter`, `F1`-`F8`)
- Localization: RU, EN, Traditional Chinese, German, Spanish

## Quick Start (Docker Compose)

### 1) Create `.env`

Minimal example:

```bash
UID=1000
GID=1000
PANEO_SOURCE_1=/home/user/Documents
PANEO_SOURCE_2=/mnt/storage
FILE_MANAGER_ROOTS="docs=/data/source-1;storage=/data/source-2"
```

`PANEO_SOURCE_1` and `PANEO_SOURCE_2` are required (no default fallback paths).

### 2) Run production container

```bash
docker compose up -d
```

Open: `http://localhost:3000`

### 3) Stop

```bash
docker compose down
```

## Docker Compose Modes

### Production (`docker-compose.yml`)

- Uses prebuilt image: `ghcr.io/codewec/paneo:latest`
- Suitable for end users and deployment

Run:

```bash
docker compose up -d
```

### Development (`docker-compose.dev.yml`)

- Builds local image
- Runs Nuxt in development mode with source mounted

Run:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Stop:

```bash
docker compose -f docker-compose.dev.yml down
```

## Configuration

### Root Sources (`FILE_MANAGER_ROOTS`)

The app only works inside explicitly allowed roots from this variable.

Example:

```bash
FILE_MANAGER_ROOTS="docs=/data/source-1;storage=/data/source-2;/tmp"
```

Supported formats:

- `;`-separated entries
- newline-separated entries
- optional alias syntax: `alias=/path`

If no root is selected in a panel, it shows the source list.

### What Variables Mean

Use only 3 variables in `.env`:

- `UID`
- `GID`
- `PANEO_SOURCE_1`
- `PANEO_SOURCE_2`
- `FILE_MANAGER_ROOTS`

Simple meaning:

- `UID` and `GID` are your Linux user/group IDs. Container runs with them, so new files are created with your host user ownership.
- `PANEO_SOURCE_1` and `PANEO_SOURCE_2` are folders on your host (your real disk).
- Docker mounts them into the container as:
  - `/data/source-1`
  - `/data/source-2`
- `FILE_MANAGER_ROOTS` tells paneo what to show in the root list.
- In `FILE_MANAGER_ROOTS` you must use container paths (`/data/source-1`, `/data/source-2`), not host paths.

Important:

1. A folder must be mounted (`PANEO_SOURCE_1` / `PANEO_SOURCE_2`).
2. The same mounted path must be listed in `FILE_MANAGER_ROOTS`.

If these paths do not match, source navigation will fail.

## Technical Details

### Stack

- Nuxt 4
- Nuxt UI
- Nitro server routes (`/api/fs/*`)
- `@nuxtjs/i18n`

### Local Development (pnpm)

Requirements:

- Node.js 20+
- pnpm

Commands:

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
```

### Project Structure

- `app/pages/index.vue` - page layout and UI wiring
- `app/composables/useFileManagerPanels.ts` - panel state, navigation, selection
- `app/composables/useFileManagerActions.ts` - operations, progress tasks, action gating
- `app/composables/useFileManagerApi.ts` - frontend API client
- `app/composables/useFileManagerHotkeys.ts` - keyboard shortcuts
- `server/utils/file-manager.ts` - secure filesystem logic (normalization, root sandboxing)
- `server/api/fs/*` - server API handlers
- `i18n/locales/*` - localization files

### Security Notes

- All filesystem operations are constrained to configured roots.
- Path traversal outside roots is rejected.
- Potentially destructive actions require confirmation.

### Browser Notes

Drag-and-drop behavior may differ across browser/desktop combinations.
If DnD is limited in your environment, use `F2 Upload` as fallback.
