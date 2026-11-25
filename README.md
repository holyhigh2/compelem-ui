# compelem-ui

A Web Components UI library built on [compelem](https://www.npmjs.com/package/compelem), [myfx](https://www.npmjs.com/package/myfx) and [uiik](https://www.npmjs.com/package/uiik). 103 components, Shadow DOM encapsulated, no framework runtime required.

## Features

- **Web Components** — every component is a custom element; works with React / Vue / Svelte / plain HTML.
- **103 components** — data display (`ce-table`, `ce-tree`, `ce-board`, `ce-editable` …), form (13 input variants, `ce-form` with rules), navigation, overlays, feedback, layout.
- **Per-component entries** — `import 'compelem-ui/ce-button'` loads only that component (~9 KB gzip).
- **Themeable** — one CSS file of design tokens (`--ce-color-*`, `--ce-round-*`, `--ce-font-*`) drives all components.

## Install

```bash
npm install compelem-ui
```

Peer dependencies (must be resolvable by your app): `compelem`, `myfx`, `uiik`.
`exceljs` is an **optional** peer, only needed when calling `exportExcel`.
`compelem-router` is also optional: install it when using `ce-card`'s `to` navigation.

| Package | Range |
|---|---|
| `compelem` | `>=0.30.0-beta.13 <0.31.0` |
| `myfx` | `>=2.0.0-beta.4 <2.1.0` |
| `uiik` | `^1.5.0` |
| `exceljs` (optional) | `^4.4.0` |

## Usage

### Recommended: per-component entry

Importing a component subpath **registers its tag** as a side effect — no extra call needed.

```js
import 'compelem-ui/index.css'   // design tokens + reset
import 'compelem-ui/ce-button'   // registers <ce-button>

document.body.innerHTML = '<ce-button appearance="primary">Click</ce-button>'
```

Get the class if you need to extend it:

```js
import { Button } from 'compelem-ui/ce-button'
```

### Register everything at once

`compelem-ui/register` exports every class and registers all 103 tags as a side effect. It is a single file and is not tree-shakable — use it for quick integration or local debugging:

```js
import 'compelem-ui/index.css'
import 'compelem-ui/register'
```

For production, prefer per-component entries so only the components you use are shipped. `npm run build:debug` also produces a bundle that registers all tags for local debugging.

### Root entry

```js
import { Button } from 'compelem-ui'
```

The root entry exports every class but **does not register any tag**. Call `defineComponents()` (or `defineComponentsSubset([...])`) from `compelem` once after importing the classes you use. With Vite / Rollup / esbuild, unused classes are tree-shaken (measured: a Button-only bundle is ~48 KB raw / ~12 KB gzip); for guaranteed minimal output or strict control, use subpath imports.

### Importing from a path

| Path | Contents |
|---|---|
| `compelem-ui` | all classes + helpers (no registration) |
| `compelem-ui/register` | all classes + registers all tags (single file, not tree-shakable) |
| `compelem-ui/ce-<tag>` | one component + registers it |
| `compelem-ui/icons` | built-in SVG icon factories |
| `compelem-ui/index.css` | design tokens, reset, base styles |

## Theming

All visual tokens are CSS custom properties on `:root`. Override them after importing `index.css`:

```css
:root {
  --ce-color-primary: rgb(37 99 235);
  --ce-color-primary-rgb: 37 99 235; /* 透明叠加用：rgb(var(--ce-color-primary-rgb) / .2) */
  --ce-round-md: 8px;
  --ce-font-family: 'Inter', system-ui, sans-serif;
}
```

Every color ships as a pair: `--ce-color-<name>` (full color) and `--ce-color-<name>-rgb` (space-separated channels). Keep both in sync when overriding.

Icons and extra stylesheets can be swapped at runtime:

```js
import { createIcons, createStyles } from 'compelem-ui'

createIcons({ MyIconSet })       // CSS font-family based icon sets
createStyles(['.my-extra-css{}']) // injected into every component shadow root
```

## Development

```bash
npm install
npm run build:lib   # production build → dist/
npm run build:debug # unminified + sourcemap build → dist-debug/
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run test:coverage
npm run gen            # regenerate the tag/event type map
npm run check          # validate generated types + contracts/fonts/colors
npm run verify:pkg     # verify dist targets / d.ts after a build
```

All source-derived generators live in `scripts/gen.mjs`, all contract and debt checks in `scripts/check.mjs`.
Component entry sources are generated into ignored `.generated/entries` by `npm run build:lib`; they are not committed or shipped. Published `ce-*` subpaths use one wildcard `exports` rule, so adding a component does not rewrite `package.json`.
For a single step, pass the target directly, e.g. `node scripts/gen.mjs types`,
`node scripts/check.mjs fonts`, `node scripts/gen.mjs types --check`.

### Build output (`dist/`)

- `compelem-ui.es.js` — root entry (re-exports only)
- `ce-<tag>.es.js` — 103 per-component self-registering entries
- `icons.es.js` — icon factories
- `index.css` — design tokens + reset (must be imported explicitly)
- `index.d.ts`, `entries/ce-<tag>.d.ts` — TypeScript declarations
- `*.js` chunks — shared implementation, hashed by content

### Publishing

```bash
npm run check
npm run test:coverage
npm run build:lib
npm run verify:pkg
npm publish   # prepublishOnly re-runs the full gate
```

## License

MIT
