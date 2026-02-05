# website-articles-build

Shared build scripts for processing Markdown blog entries into JSON.

Used as a git subtree in:
- [angular-buch/website-articles](https://github.com/angular-buch/website-articles)
- [angular-schule/website-articles](https://github.com/angular-schule/website-articles)

## Usage

```bash
npm install
npm run build
```

## Scripts

| Script       | Description                          |
|--------------|--------------------------------------|
| `build`      | Build blog and material entries      |
| `test`       | Run tests                            |
| `test:watch` | Run tests in watch mode              |
| `typecheck`  | TypeScript type checking             |
| `watch`      | Watch mode for development           |

## Folder Structure

```
├── build.ts                 # Main entry point
├── blog/
│   ├── blog.types.ts        # Blog-specific types
│   └── blog.utils.ts        # Blog list utilities
├── material/
│   └── material.types.ts    # Material-specific types
└── shared/
    ├── base.types.ts        # Shared base types
    ├── base.utils.ts        # File/folder utilities
    ├── list.utils.ts        # List extraction utilities
    └── jekyll-markdown-parser.ts  # Markdown parser
```

## URL Placeholder

Generated URLs use `%%MARKDOWN_BASE_URL%%` as a placeholder:
- `%%MARKDOWN_BASE_URL%%/blog/2024-post/image.png`
- `%%MARKDOWN_BASE_URL%%/material/chapter-1/diagram.svg`

The consuming website replaces this placeholder with the actual base URL at runtime.

## Input/Output

**Input:** `../blog/` and `../material/` folders with Markdown READMEs

**Output:** `./dist/` folder with:
- `dist/blog/list.json` - Light blog list for overview
- `dist/blog/{slug}/entry.json` - Full blog entry
- `dist/material/list.json` - Light material list
- `dist/material/{slug}/entry.json` - Full material entry
