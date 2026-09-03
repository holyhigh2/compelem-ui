# compelem-ui

A UI component library built on top of [compelem](https://www.npmjs.com/package/compelem), [myfx](https://www.npmjs.com/package/myfx) and [uiik](https://www.npmjs.com/package/uiik).

## ✨ Features

- **Web Component based** — each component is a custom element managed by the `compelem` framework.
- **Rich component set** — data display (`Table`, `Tree`, `Board`, `Stat` …), navigation (`Dropdown`, `MenuPane`, `Tabs`, `Accordion` …), feedback (`Message`, `Notification`, `Dialog` …), form (`Input`*, `Select`, `DatePicker` …), layout (`Grid`, `Container`, `Card`, `Portal` …) and more.
- **Themeable** — appearance / reset stylesheets can be customized through `CompElem.defaults`.
- **Tree-shakable** — import only the components you actually use.

## 🚀 Getting Started

```bash
npm install compelem-ui
```

Then import the components you need:

```js
import { Button, Dialog } from 'compelem-ui'
```

## 🛠 Development

```bash
npm install        # install dependencies
npm run dev        # start the demo site (http://localhost:5173)
npm run build:lib  # build the distributable library into dist/
npm run typecheck  # run the TypeScript type checker
```

### Build output (`dist/`)

- `compelem-ui.es.js` — ES module bundle
- `compelem-ui.umd.js` — UMD bundle
- `style.css` — compiled stylesheet
- `index.d.ts` — TypeScript declarations
- `README.md`, `package.json` — package metadata copied for publishing

## 📦 Publishing

The `package.json` `files` field includes the whole `dist/` directory, so you can publish directly from the build output:

```bash
npm run build:lib
npm publish
```

## 📄 License

MIT
