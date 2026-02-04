# website-articles-build

Shared build scripts for processing Markdown blog entries into JSON.

Used as a git submodule in:
- [angular-buch/website-articles](https://github.com/angular-buch/website-articles)
- [angular-schule/website-articles](https://github.com/angular-schule/website-articles)

## Usage

```bash
npm install
npm run build
```

## Build Scripts

| Script           | Description                                                      |
|------------------|------------------------------------------------------------------|
| `build:init`     | Clears `dist/`                                                   |
| `build:blog`     | Builds blog entries from `../blog/` → `dist/blog/`               |
| `build:material` | Builds material entries from `../material/` → `dist/material/`   |

**Note:** `build:material` gracefully exits if no `../material/` folder exists.

## URL Placeholder

Generated URLs use `%%MARKDOWN_BASE_URL%%` as a placeholder:
- `%%MARKDOWN_BASE_URL%%/blog/2024-post/image.png`
- `%%MARKDOWN_BASE_URL%%/material/chapter-1/diagram.svg`

The consuming website replaces this placeholder with the actual base URL at runtime.

## Tests

```bash
npm test
```
