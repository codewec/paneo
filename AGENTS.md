# AI Agent Guide: paneo

## Project Purpose

paneo is a keyboard-first, two-pane file manager inspired by Total Commander and Midnight Commander.
It runs as a Nuxt 4 app and is intended to be deployed in Docker, with filesystem access restricted to configured roots.

## Tech Stack

- Nuxt 4
- Nuxt UI
- Nitro server routes for filesystem operations
- @nuxtjs/i18n (locale JSON files)

## Runtime Model

- Frontend and backend are in the same Nuxt project.
- Backend exposes `/api/fs/*` endpoints.
- Filesystem operations are allowed only inside configured roots.
- Roots are configured via `FILE_MANAGER_ROOTS`.
- Optional auth is enabled only when `PANEO_AUTH_PASSWORD` is set.

## Root Configuration

Environment variable format:

- `FILE_MANAGER_ROOTS="alias1=/path1;alias2=/path2;/path3"`

Parsing rules:

- `;` or newline separator
- optional alias (`alias=path`)
- if alias is omitted, basename/path is used as display name

## Data Persistence

- Favorites are stored server-side in `/app/.paneo/favorites.json` (internal constant path).
- For Docker persistence, mount a host volume to `/app/.paneo` (configure via `PANEO_DATA_DIR` in Compose).

## Key Directories

- `app/pages/index.vue`
  - file manager workspace page
- `app/pages/auth.vue`
  - auth page (SSR redirect target)
- `app/components/file-manager/FileManagerWorkspace.vue`
  - workspace orchestration (panels, hotkeys, modal wiring)
- `app/components/file-manager/*`
  - panel/action/startup/modal UI components
- `app/composables/useFileManagerApi.ts`
  - frontend API client (`/api/fs/*`)
- `app/composables/useFileManagerPanels.ts`
  - panel state, navigation, selection, history
- `app/composables/useFileManagerActions.ts`
  - file actions, copy/upload tasks, action gating
- `app/composables/useFileManagerFavorites.ts`
  - favorites state, modal actions, toggle/open logic
- `app/composables/usePaneoAuth.ts`
  - auth actions (login/logout)
- `app/composables/useFileManagerHotkeys.ts`
  - global keyboard shortcuts
- `server/utils/file-manager.ts`
  - secure filesystem logic (path normalization, root enforcement, operations)
- `server/utils/favorites-store.ts`
  - favorites persistence (read/write/cleanup)
- `server/utils/startup-status.ts`
  - startup validation (env/access/warnings)
- `server/utils/auth-session.ts`
  - auth session signing/verification helpers
- `server/middleware/auth-redirect.ts`
  - SSR route guard (`/` <-> `/auth`)
- `server/middleware/auth-api.ts`
  - API auth guard (`/api/*`)
- `server/api/fs/*.ts`
  - HTTP handlers
- `server/api/system/startup.get.ts`
  - startup status endpoint
- `i18n/locales/*.json`
  - localization resources

## Architecture Notes

1. Panels are independent
- each panel keeps its own root, current path, selection, marked entries, and list state.

2. Navigation safety
- operations are restricted to configured roots.
- path traversal is blocked.
- navigation into inaccessible directories is prevented/rolled back and surfaced via toast.

3. Root level behavior
- when no root is selected, panel shows source list.
- most file actions are disabled in source-list context.

4. Selection behavior
- first item is selected after load.
- going up selects the previous folder where applicable.
- list auto-scroll follows keyboard selection.

5. Favorites
- only folders can be favorited.
- star icon in row toggles favorite.
- favorites modal can open/remove entries.
- favorites are validated on server; missing/inaccessible entries are dropped.

6. Auth
- if `PANEO_AUTH_PASSWORD` is empty, app opens directly.
- if it is set, unauthenticated users are SSR-redirected to `/auth`.
- after successful login user is redirected back to `/`.
- logout is available from Settings modal.

## Localization

- Module: `@nuxtjs/i18n`
- Locale files:
  - `i18n/locales/ru.json`
  - `i18n/locales/en.json`
  - `i18n/locales/zh-Hant.json`
  - `i18n/locales/de.json`
  - `i18n/locales/es.json`
- Selected language is persisted in cookie key `paneo.locale`.

## Keyboard Shortcuts

- `Tab`: switch active panel
- `ArrowUp/ArrowDown`: move selection
- `PageUp/PageDown`: page-wise selection move
- `Enter`: open selected root/folder/`..`
- `Insert` / `T`: mark/unmark and move down
- `F`: toggle favorite for current selected folder
- `F1`: settings
- `F2`: favorites modal
- `F3`: view
- `F4`: edit (text files)
- `F5`: copy/move workflow
- `F6`: rename
- `F7`: create
- `F8`: delete
- `F9`: upload
- `F10`: download

## API Endpoints

- `GET /api/fs/roots`
- `GET /api/fs/list?rootId=...&path=...`
- `GET /api/fs/read?rootId=...&path=...`
- `GET /api/fs/raw?rootId=...&path=...`
- `GET /api/fs/meta?rootId=...&path=...`
- `GET /api/fs/download?rootId=...&path=...`
- `POST /api/fs/write`
- `POST /api/fs/mkdir`
- `POST /api/fs/create-file`
- `POST /api/fs/delete`
- `POST /api/fs/copy`
- `POST /api/fs/copy-start`
- `GET /api/fs/copy-status`
- `POST /api/fs/copy-cancel`
- `POST /api/fs/move`
- `POST /api/fs/upload`
- `POST /api/fs/upload-cancel`
- `POST /api/fs/import-local`
- `GET /api/fs/favorites`
- `POST /api/fs/favorites-add`
- `POST /api/fs/favorites-remove`

## Agent Editing Guidelines

- Keep UI on Nuxt UI components.
- Do not bypass server-side root/path validation.
- Preserve keyboard workflow and panel independence.
- Add translations to all locale files when introducing UI text.
- Keep destructive actions behind confirmation UX.
- Prefer composables for behavior; avoid overloading `index.vue`.

## Useful Local Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
```

If i18n/module config changes do not appear, restart dev server and clear `.nuxt`.
