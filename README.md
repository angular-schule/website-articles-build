# website-articles-build

Build-System für Blog- und Material-Artikel. Transformiert Markdown zu JSON für die Angular-Websites.

Wird als Git-Submodule verwendet in:
- [angular-buch/website-articles](https://github.com/angular-buch/website-articles)
- [angular-schule/website-articles](https://github.com/angular-schule/website-articles)

## Setup

```bash
npm install
npm run build    # Einmaliger Build
npm run watch    # Watch-Mode für Entwicklung
npm test         # Tests ausführen
npm run typecheck # TypeScript prüfen
```

## Projekt-Struktur

```
website-articles-build/
├── build.ts              # Haupt-Build-Script
├── blog/
│   ├── blog.types.ts     # Blog-spezifische Typen
│   └── blog.utils.ts     # Blog-spezifische Utilities
├── material/
│   └── material.types.ts # Material-spezifische Typen
└── shared/
    ├── jekyll-markdown-parser.ts  # Markdown-Parser
    ├── base.utils.ts              # Gemeinsame Utilities
    └── list.utils.ts              # Listen-Utilities
```

## Output

Der Build erzeugt für jeden Artikel:

| Output | Beschreibung |
|--------|--------------|
| `dist/blog/{slug}/entry.json` | Vollständiger Artikel mit HTML |
| `dist/blog/list.json` | Liste aller Artikel (Light-Version) |
| `dist/material/{slug}/entry.json` | Vollständiger Material-Eintrag |
| `dist/material/list.json` | Liste aller Material-Einträge |

---

## Features für Markdown-Autoren

### 1. Bilder

Relative Bildpfade werden automatisch transformiert:

```markdown
![Screenshot](screenshot.png)
![Logo](./images/logo.png)
```

**Build-Output:**
```html
<img src="%%MARKDOWN_BASE_URL%%/blog/my-article/screenshot.png">
```

Der Placeholder `%%MARKDOWN_BASE_URL%%` wird zur Laufzeit durch die Angular-App ersetzt (CDN auf Prod, Proxy in Dev).

**Nicht transformiert werden:**
- Absolute URLs: `https://example.com/image.png`
- Protokoll-relative URLs: `//cdn.example.com/image.png`
- Asset-Pfade: `assets/img/icon.svg`
- Absolute Pfade: `/images/logo.png`
- Data-URIs: `data:image/png;base64,...`

### 2. Links

Relative Links werden zu absoluten Pfaden transformiert. Das ist notwendig, weil Angular `<base href="/">` verwendet.

#### Anker-Links (TOC)

```markdown
[Einleitung](#einleitung)
```

**Build-Output:**
```html
<a href="/blog/my-article#einleitung">Einleitung</a>
```

#### Cross-Article Links

```markdown
[Anderer Artikel](../other-article)
[Anderer Artikel mit Anker](../other-article#setup)
```

**Build-Output:**
```html
<a href="/blog/other-article">Anderer Artikel</a>
<a href="/blog/other-article#setup">Anderer Artikel mit Anker</a>
```

**Nicht transformiert werden:**
- Absolute URLs: `https://angular.io/docs`
- Bereits absolute Pfade: `/blog/other-article`
- mailto: `mailto:team@example.com`
- tel: `tel:+49123456`
- ftp: `ftp://files.example.com/file.zip`

### 3. Automatisches Inhaltsverzeichnis (TOC)

Platziere `[[toc]]` im Markdown, um ein automatisches Inhaltsverzeichnis zu generieren.

#### Beispiel

```markdown
---
title: Mein Artikel
published: 2024-01-15
---

## Inhalt

[[toc]]

## Einleitung

Lorem ipsum...

### Unterkapitel

Mehr Text...

## Fazit

Ende.
```

#### Generierter Output

```html
<h2 id="inhalt">Inhalt</h2>
<ul>
  <li><a href="/blog/my-article#einleitung">Einleitung</a></li>
  <li>
    <ul>
      <li><a href="/blog/my-article#unterkapitel">Unterkapitel</a></li>
    </ul>
  </li>
  <li><a href="/blog/my-article#fazit">Fazit</a></li>
</ul>
```

#### Regeln

| Regel | Beschreibung |
|-------|--------------|
| **Nur h2 und h3** | h1 und h4+ werden ignoriert |
| **Nach dem Marker** | Headings vor `[[toc]]` werden übersprungen |
| **Automatische IDs** | Heading-IDs werden von `marked-gfm-heading-id` generiert |
| **Sonderzeichen** | `Über uns` → `#%C3%BCber-uns`, `FAQ & Hilfe` → `#faq--hilfe` |

### 4. Syntax-Highlighting

Code-Blöcke werden automatisch mit highlight.js formatiert:

````markdown
```typescript
const greeting = 'Hello World';
console.log(greeting);
```
````

### 5. Raw HTML

HTML im Markdown wird unverändert durchgereicht:

```markdown
<div class="custom-box">
  <p>Custom styled content</p>
</div>

<iframe src="https://stackblitz.com/edit/angular" width="100%"></iframe>
```

**Sicherheitshinweis:** Das ist beabsichtigt. Wir vertrauen unserem eigenen Repository. Es gibt keinen User-Generated Content.

### 6. Emojis

Emoji-Shortcodes werden zu Unicode konvertiert:

```markdown
Hello :smile: World :rocket:
```

**Output:** Hello 😄 World 🚀

---

## YAML Frontmatter

Jeder Artikel benötigt YAML Frontmatter:

```yaml
---
title: "Artikel-Titel"
author: Max Mustermann
mail: max@example.com
published: 2024-01-15
language: de
header: header.jpg
keywords:
  - Angular
  - TypeScript
# Optional:
lastModified: 2024-02-01
hidden: false      # Artikel nicht in Liste anzeigen
sticky: false      # Artikel oben anpinnen
darkenHeader: false
author2: Co-Autor
mail2: co@example.com
bio: Kurze Bio des Autors
---
```

### Datum-Formate

Beide Formate werden unterstützt:

```yaml
published: 2024-01-15              # Wird zu ISO-String konvertiert
published: "2024-01-15T10:00:00Z"  # Bleibt als String
```

---

## Entwicklung

### Tests

```bash
npm test           # Einmalig
npm run test:watch # Watch-Mode
```

131 Tests decken ab:
- Markdown-Parsing und HTML-Generierung
- Bild- und Link-Transformation
- TOC-Generierung
- Edge Cases (mailto, tel, CRLF, etc.)

### TypeScript

```bash
npm run typecheck  # Typen prüfen
```

### Architektur

```
Markdown (README.md)
    ↓
JekyllMarkdownParser
    ├── YAML Frontmatter → parsedYaml
    ├── Markdown → marked → HTML
    ├── Image URLs → transformiert mit Placeholder
    ├── Links → transformiert zu absoluten Pfaden
    └── TOC → generiert aus Headings
    ↓
entry.json
```

---

## Submodule-Hinweis

Dieses Repository wird als Git-Submodule in `website-articles` eingebunden.

**Änderungen immer hier vornehmen**, nicht im `build/`-Ordner des Parent-Repos!

```bash
# RICHTIG: Hier arbeiten
cd website-articles-build
git checkout -b feature/xyz

# FALSCH: Nicht im Submodule arbeiten
cd website-articles/build  # ❌
```
