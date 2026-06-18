# rehype-perfect-code-blocks — Feature Showcase

Every feature in one file. Open this in any Astro project with the plugin configured.

## 1. Basic block with title

```ts title="src/env.ts"
export const API_URL = 'https://api.example.com'
export const TIMEOUT = 30000
```

## 2. Line highlighting with `{1,3-5}`

```js {1,3-5}
const a = 1
const b = 2
const c = 3
const d = 4
const e = 5
const f = 6
```

## 3. Focus mode (dims non-highlighted lines)

```js title="src/store.ts" {3,5-6}
import { createStore } from 'solid-js/store'

export const [state, setState] = createStore({
  count: 0,
  user: null as User | null,
  theme: 'dark' as 'dark' | 'light',
})
```

## 4. Diff lines (`// [!code ++]` / `// [!code --]`)

```ts title="package.json"
{
  "name": "my-app",
  // [!code --]
  "version": "1.2.0",
  // [!code ++]
  "version": "1.3.0",
  "dependencies": { "astro": "^5.0.0" }
}
```

## 5. Error and warning lines

```ts title="validator.ts"
const x = getUserInput() // [!code error]
if (!x) {
  console.warn('empty input') // [!code warning]
}
```

## 6. Word highlighting with `/word/`

```js /foo/ /bar/2-3
const foo = 'foo'
function bar() { foo() + foo() }
bar() + bar() + bar()
```

## 7. Word highlighting via `// [!code word:foo]`

```ts
// [!code word:useState]
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

## 8. VitePress notations — all of them combined

```ts title="example.ts"
const a = 1 // [!code highlight]
const b = 2 // [!code focus]
const c = 3 // [!code focus:2]
const d = 4
const e = 5 // [!code ++]
const f = 6 // [!code --]
const g = 7 // [!code error]
const h = 8 // [!code warning]
```

## 9. Docusaurus magic comments

```ts
// highlight-next-line
const important = 'this is highlighted'
// highlight-start
const block1 = 'first highlighted line'
const block2 = 'second highlighted line'
// highlight-end
const notHighlighted = 'this is normal'
```

## 10. Custom magic comments

Registered in config:

```ts
// error-next-line
const crashy = doSomethingRisky()
```

## 11. Caption

```js title="auth.js" caption="Source: src/lib/auth.js — MIT licensed"
export function signIn(user) {
  return fetch('/api/login', { method: 'POST', body: JSON.stringify(user) })
}
```

## 12. Wrap mode

```js title="long-line.js" wrap
export const config = { apiBase: 'https://api.example.com/v2/long-endpoint-path-that-keeps-going', timeout: 30000, retries: 5 }
```

## 13. Collapsible

```js title="long-output.log" collapse
[INFO] booting worker...
[INFO] connecting to postgres://localhost:5432
[INFO] running migrations 0001..0042
[INFO] listening on :3000
[INFO] ready
```

## 14. Start line numbers at N

```js title="snippet-2.js" ln{42}
// This is line 42 of the original file
function lateInit() {
  return true
}
```

## 15. Auto terminal frame

```bash title="setup.sh"
$ npm install
$ npm run build
$ npm start
```

```ts title="app.ts"
// This stays as the default (editor) frame
const app = createApp()
app.mount('#root')
```

## 16. Filename from comment (with `extractFileNameFromCode: true`)

```js
// src/components/Button.tsx
export function Button({ children }) {
  return <button>{children}</button>
}
```

## 17. All ornaments off

```js title="minimal.js" noDecorations noLang noCopy
const x = 1
```

## 18. Visible whitespace

```js title="whitespace.js" 
function indented() {
	const x = 1        // tab
	const y = '  two'  // spaces
	return x + y
}
```

(Set `showWhitespace: 'all'` globally, or per-block via custom notation.)

## 19. Preset: terminal

```bash
$ echo "preset=terminal applies compact styling"
```

## 20. Preset: minimal

```js title="minimal-preset.js"
const data = { ok: true }
```

(Set `preset: 'minimal'` globally.)

## 21. Multiple blocks + inline code

Use `npm install` to install. The build outputs to `dist/`. Inline code with `{:lang}`:

(Set `inlineCode: 'lang'` and write `` `const x = 1{:ts}` `` for tokenized inline code.)
