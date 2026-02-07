# fFile

A two-pane file manager built with Nuxt 4 and Nuxt UI.

## Features

- two independent file panels
- navigation across multiple configured roots (from environment variable)
- image and text file preview
- text file editing (basic notepad mode)
- copy and move between panels (including different roots)
- file and folder deletion
- folder creation
- keyboard-driven workflow (Tab, arrows, PageUp/PageDown, Enter, F1, F3-F8)
- UI localization (Russian/English)

## Configure roots via ENV

The app reads available roots from `FILE_MANAGER_ROOTS`.

Supported formats:

- `;`-separated list
- one path per line
- optional alias syntax: `alias=/path/to/dir`

Example:

```bash
FILE_MANAGER_ROOTS="media=/data/media;docs=/data/docs;/tmp"
```

If a panel has no selected root, it shows the top-level source list from `FILE_MANAGER_ROOTS`.

## Install & Run

```bash
pnpm install
pnpm dev
```

## Docker

Mount host directories and pass `FILE_MANAGER_ROOTS`:

```bash
docker run --rm -p 3000:3000 \
  -e FILE_MANAGER_ROOTS="media=/mnt/media;docs=/mnt/docs" \
  -v /host/media:/mnt/media \
  -v /host/docs:/mnt/docs \
  your-image
```

## Notes

- i18n is configured via `@nuxtjs/i18n` with lazy locale files in `i18n/locales`.
- The backend enforces root sandboxing and prevents path traversal.
