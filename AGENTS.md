# AI Agent Guide: fFile

## Project Purpose

fFile is a keyboard-friendly, two-pane file manager inspired by Total Commander/Midnight Commander.
It runs as a Nuxt 4 app and is intended to be deployed in Docker, with filesystem access restricted to configured roots.

## Tech Stack

- Nuxt 4
- Nuxt UI
- Nitro server routes for filesystem operations
- @nuxtjs/i18n (lazy-loaded locale JSON files)

## Runtime Model

- Frontend and backend are in the same Nuxt project.
- The backend exposes `/api/fs/*` endpoints that perform filesystem operations under configured roots only.
- Root directories are provided by env variable `FILE_MANAGER_ROOTS`.

## Root Configuration

Environment variable:

- `FILE_MANAGER_ROOTS="alias1=/path1;alias2=/path2;/path3"`

Parsing rules:

- supports `;` separator or newline separator
- optional alias via `alias=path`
- if no alias is provided, basename/path is used as display name

## Key Directories

- `app/pages/index.vue`
  - page composition and UI layout
- `app/composables/useFileManagerApi.ts`
  - frontend API calls to `/api/fs/*`
- `app/composables/useFileManagerPanels.ts`
  - panel state, navigation, selection, keyboard movement helpers
- `app/composables/useFileManagerActions.ts`
  - file actions (view/edit/copy/move/delete/mkdir), button state rules
- `app/composables/useFileManagerHotkeys.ts`
  - global keyboard shortcuts (Tab, arrows, PgUp/PgDn, Enter, F1, F3-F8)
- `server/utils/file-manager.ts`
  - secure filesystem logic (path normalization, root enforcement, operations)
- `server/api/fs/*.ts`
  - HTTP handlers for fs operations
- `i18n/locales/*.json`
  - localization resources

## Architecture Notes

1. Panels are independent
- each panel keeps its own root, current path, selected item, and entry list

2. Navigation safety
- operations are restricted to configured roots
- path traversal is blocked
- navigation into inaccessible directories is rolled back and shown as toast error

3. Root level behavior
- when no root is selected, panel displays root list
- action buttons are disabled in root list context where file actions are invalid

4. Selection behavior
- first item is selected after folder load
- going up selects the folder that user came from
- list auto-scroll follows keyboard selection

## Localization

- Module: `@nuxtjs/i18n`
- Config: `nuxt.config.ts` (`lazy: true`, `langDir: 'locales'`)
- Locale files:
  - `i18n/locales/ru.json`
  - `i18n/locales/en.json`
- Selected UI language is persisted in localStorage key `ffile.locale`.

## Keyboard Shortcuts

- `Tab`: switch active panel
- `ArrowUp/ArrowDown`: move selection
- `PageUp/PageDown`: page-wise selection move
- `Enter`: open selected root/folder/`..`
- `F1`: open settings modal
- `F3`: view file
- `F4`: edit file
- `F5`: copy
- `F6`: move
- `F7`: create folder
- `F8`: delete

## API Endpoints

- `GET /api/fs/roots`
- `GET /api/fs/list?rootId=...&path=...`
- `GET /api/fs/read?rootId=...&path=...`
- `GET /api/fs/raw?rootId=...&path=...`
- `POST /api/fs/write`
- `POST /api/fs/mkdir`
- `POST /api/fs/delete`
- `POST /api/fs/copy`
- `POST /api/fs/move`

## Agent Editing Guidelines

- Keep all UI components based on Nuxt UI.
- Do not bypass server-side root/path validation.
- Preserve keyboard-driven flow and panel independence.
- When adding UI text, add translations to both `ru.json` and `en.json`.
- For potentially destructive actions, keep confirmation UX intact.
- Prefer extending composables over adding logic back into `index.vue`.

## Useful Local Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
```

If localization or module config changes do not appear, restart dev server and clear `.nuxt`.
