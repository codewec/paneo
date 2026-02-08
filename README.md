# paneo

paneo is a keyboard-first, two-pane file manager inspired by Midnight Commander and Total Commander.
Built with Nuxt 4 + Nuxt UI, it is designed to run in Docker with filesystem access restricted to configured roots.

## Features

- Two fully independent panels
- Optional password auth (enabled when `PANEO_AUTH_PASSWORD` is set)
- Configurable source roots from environment variables
- File/folder operations: create, rename, copy, move, delete
- Multi-select support (keyboard + mouse)
- File viewer and text editor
- Favorites for folders:
  - `F2` opens favorites modal
  - star icon in folder rows to add/remove favorites
  - `F` toggles favorite for current selected folder
- Upload with drag-and-drop and file/folder picker (`F9`)
- Download files/folders to local machine (`F10`)
  - single file downloads directly
  - multiple selected items are downloaded as `.tar.gz`
- Progress tracking for copy/upload (modal + toast, minimize/cancel)
- Keyboard workflow (`Tab`, arrows, `PgUp/PgDn`, `Enter`, `F1`-`F10`, `Insert`, `T`, `F`)
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
PANEO_AUTH_PASSWORD=
PANEO_AUTH_SECRET=
PANEO_AUTH_COOKIE_SECURE=false

# Persist paneo internal data (favorites, service state)
PANEO_DATA_DIR=./paneo-data
```

`PANEO_SOURCE_1` and `PANEO_SOURCE_2` are required (no default fallback paths).
If `PANEO_AUTH_PASSWORD` is empty, login is disabled.

### 2) Mount a persistent data volume (recommended)

Add this volume to `docker-compose.yml`:

```yaml
services:
  paneo:
    volumes:
      - ${PANEO_SOURCE_1}:/data/source-1
      - ${PANEO_SOURCE_2}:/data/source-2
      - ${PANEO_DATA_DIR}:/app/.paneo
```

This mount is recommended so favorites and paneo internal data are not lost when the container is recreated.

### 3) Run production container

```bash
docker compose up -d
```

Open: `http://localhost:3000`

### 4) Stop

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

Common `.env` variables:

- `UID`
- `GID`
- `PANEO_SOURCE_1`
- `PANEO_SOURCE_2`
- `FILE_MANAGER_ROOTS`
- `PANEO_AUTH_PASSWORD` (optional)
- `PANEO_AUTH_SECRET` (optional, recommended)
- `PANEO_AUTH_COOKIE_SECURE` (optional, default: `false`)
- `PANEO_DATA_DIR` (recommended)

Simple meaning:

- `UID` and `GID` are your Linux user/group IDs. Container runs with them, so new files are created with your host user ownership.
- `PANEO_SOURCE_1` and `PANEO_SOURCE_2` are folders on your host (your real disk).
- Docker mounts them into the container as:
  - `/data/source-1`
  - `/data/source-2`
- `FILE_MANAGER_ROOTS` tells paneo what to show in the root list.
- In `FILE_MANAGER_ROOTS` you must use container paths (`/data/source-1`, `/data/source-2`), not host paths.
- `PANEO_AUTH_PASSWORD` enables authentication. Leave empty to disable auth.
- `PANEO_AUTH_SECRET` signs auth session cookies. If not set, a fallback secret is derived from password.
- `PANEO_AUTH_COOKIE_SECURE` controls the `secure` flag for auth cookie:
  - `false` (default) for local HTTP
  - `true` for HTTPS deployments
- `PANEO_DATA_DIR` is a host folder mounted into `/app/.paneo` to persist paneo internal data.
- Favorites file path is fixed internally as `/app/.paneo/favorites.json`.

Important:

1. A source folder must be mounted (`PANEO_SOURCE_1` / `PANEO_SOURCE_2`).
2. The same mounted path must be listed in `FILE_MANAGER_ROOTS`.
3. For persistent favorites, mount `PANEO_DATA_DIR` to `/app/.paneo`.

If these paths do not match, source navigation or persistence will fail.

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

- `app/pages/index.vue` - file manager workspace page
- `app/pages/auth.vue` - auth page (SSR redirect target)
- `app/components/file-manager/FileManagerWorkspace.vue` - workspace orchestration (panels + modal wiring)
- `app/components/file-manager/*` - panel/action/startup/modal UI components
- `app/composables/useFileManagerPanels.ts` - panel state, navigation, selection
- `app/composables/useFileManagerActions.ts` - operations, progress tasks, action gating
- `app/composables/useFileManagerFavorites.ts` - favorites state and interactions
- `app/composables/usePaneoAuth.ts` - auth actions (login/logout)
- `server/middleware/auth-redirect.ts` - SSR route guard (`/` <-> `/auth`)
- `server/middleware/auth-api.ts` - API auth guard (`/api/*`)
- `server/utils/auth-session.ts` - signed session cookie helpers
- `app/composables/useFileManagerApi.ts` - frontend API client
- `app/composables/useFileManagerHotkeys.ts` - keyboard shortcuts
- `server/utils/file-manager.ts` - secure filesystem logic (normalization, root sandboxing)
- `server/utils/favorites-store.ts` - server-side favorites storage
- `server/utils/startup-status.ts` - startup validation (roots/access/UID/GID warning)
- `server/api/fs/*` - server API handlers
- `server/api/system/startup.get.ts` - startup status endpoint
- `i18n/locales/*` - localization files

### Security Notes

- All filesystem operations are constrained to configured roots.
- Path traversal outside roots is rejected.
- Potentially destructive actions require confirmation.

### Browser Notes

Drag-and-drop behavior may differ across browser/desktop combinations.
If DnD is limited in your environment, use `F9 Upload` as fallback.
