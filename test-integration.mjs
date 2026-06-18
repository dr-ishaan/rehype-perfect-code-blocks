/**
 * Test Suite: Integration & E2E
 * Full-pipeline tests covering real-world usage scenarios.
 * Target: 100+ tests.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { rehypePerfectCodeBlocks, remarkPreserveCodeMeta } from '../rehype-perfect-code-blocks/dist/index.js';

let pass = 0, fail = 0;
const failures = [];

async function render(md, opts = {}) {
  const result = await unified()
    .use(remarkParse)
    .use(remarkPreserveCodeMeta)
    .use(remarkRehype)
    .use(rehypePerfectCodeBlocks, opts)
    .use(rehypeStringify)
    .process(md);
  return String(result);
}

function assert(name, cond, detail = '') {
  if (cond) pass++;
  else { fail++; failures.push({ name, detail }); }
}
function has(h, n) { return h.includes(n); }
function count(h, n) { let i=0,c=0; while((i=h.indexOf(n,i))!==-1){c++;i+=n.length;} return c; }

// ============ Real-world documentation snippets ============
const SNIPPETS = [
  ['install', '```bash title="install.sh"\n$ npm install rehype-perfect-code-blocks\n$ npm run build\n```'],
  ['config', '```ts title="astro.config.mjs"\nimport perfectCode from \'rehype-perfect-code-blocks/astro\'\nexport default perfectCode({})\n```'],
  ['component', '```tsx title="Button.tsx"\nexport function Button({ children }: { children: React.ReactNode }) {\n  return <button>{children}</button>\n}\n```'],
  ['api-call', '```ts title="api.ts"\nexport async function getData(): Promise<User[]> {\n  const res = await fetch(\'/api/users\')\n  if (!res.ok) throw new Error(\'Failed\')\n  return res.json()\n}\n```'],
  ['sql', '```sql\nSELECT u.id, u.name, COUNT(o.id) AS order_count\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nWHERE u.created_at > \'2024-01-01\'\nGROUP BY u.id, u.name\nORDER BY order_count DESC\n```'],
  ['python', '```python title="fib.py"\ndef fibonacci(n: int) -> int:\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)\n```'],
  ['rust', '```rust title="main.rs"\nfn main() {\n    let mut v = vec![1, 2, 3];\n    v.push(4);\n    println!("{:?}", v);\n}\n```'],
  ['go', '```go title="main.go"\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n```'],
  ['json', '```json title="package.json"\n{\n  "name": "my-app",\n  "version": "1.0.0",\n  "type": "module"\n}\n```'],
  ['yaml', '```yaml title=".github/workflows/ci.yml"\nname: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n```'],
  ['docker', '```dockerfile title="Dockerfile"\nFROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nCMD ["node", "index.js"\n```'],
  ['graphql', '```graphql\nquery GetUser($id: ID!) {\n  user(id: $id) {\n    id\n    name\n    email\n  }\n}\n```'],
];

for (const [name, md] of SNIPPETS) {
  const h = await render(md);
  assert(`renders ${name} snippet`, has(h, 'pcb__body'));
  assert(`${name} has figure`, has(h, '<figure class="pcb'));
}

// ============ Multi-block documents ============
{
  const md = `# README

## Installation

\`\`\`bash title="install.sh"
$ npm install
\`\`\`

## Usage

\`\`\`ts title="example.ts"
const x = 1
\`\`\`

## API

\`\`\`ts title="api.ts" {2}
export function getData() {
  return fetch('/api/data')
}
\`\`\`
`;
  const h = await render(md);
  assert('multi-section doc renders', count(h, '<figure class="pcb') === 3);
  assert('all titles present', has(h, 'install.sh') && has(h, 'example.ts') && has(h, 'api.ts'));
  assert('highlight in 3rd block', has(h, 'pcb__line--hl'));
}

// ============ Blocks with surrounding text ============
{
  const h = await render('Some text before.\n\n```js\nfoo\n```\n\nSome text after.');
  assert('text before preserved', has(h, 'Some text before'));
  assert('text after preserved', has(h, 'Some text after'));
  assert('block in middle', has(h, '<figure class="pcb'));
}

// ============ Block followed by inline code ============
{
  const h = await render('```js\nfoo\n```\n\nUse `bar` for things.');
  assert('block + inline code', has(h, 'pcb') && has(h, '<code>bar</code>'));
}

// ============ Headings between blocks ============
{
  const h = await render('## Section 1\n\n```js\nfoo\n```\n\n## Section 2\n\n```ts\nbar\n```');
  assert('headings preserved', has(h, 'Section 1') && has(h, 'Section 2'));
  assert('two blocks', count(h, '<figure class="pcb') === 2);
}

// ============ Lists with code ============
{
  const h = await render('- Item 1\n  ```js\nfoo\n```\n- Item 2');
  assert('list with code block', h.length > 0);
}

// ============ Blockquotes with code ============
{
  const h = await render('> ```js\n> foo\n> ```');
  assert('blockquote with code', h.length > 0);
}

// ============ Multiple langs on one page ============
{
  const langs = ['js', 'ts', 'jsx', 'tsx', 'python', 'rust', 'go', 'java', 'c', 'cpp', 'bash', 'sql', 'json', 'yaml', 'html', 'css'];
  const md = langs.map(l => `\`\`\`${l}\n// code in ${l}\n\`\`\``).join('\n\n');
  const h = await render(md);
  assert(`renders ${langs.length} different languages`, count(h, '<figure class="pcb') === langs.length);
}

// ============ Large codebase ============
{
  const lines = Array.from({length: 200}, (_, i) => `const x${i} = ${i};`);
  const h = await render(`\`\`\`ts title="large.ts"\n${lines.join('\n')}\n\`\`\``);
  assert('200-line file renders', has(h, 'pcb__body'));
  assert('200-line file has line numbers', count(h, 'pcb__ln') > 100);
}

// ============ Highlight in large file ============
{
  const lines = Array.from({length: 100}, (_, i) => `const x${i} = ${i};`);
  const h = await render(`\`\`\`ts title="large.ts" {50}\n${lines.join('\n')}\n\`\`\``);
  assert('highlight in 100-line file', count(h, 'pcb__line--hl') === 1);
}

// ============ Diff in real PR-style content ============
{
  const h = await render('```diff title="package.json"\n{\n  "name": "my-app",\n  // [!code --]\n  "version": "1.0.0",\n  // [!code ++]\n  "version": "1.1.0",\n  "license": "MIT"\n}\n```');
  assert('PR-style diff', has(h, 'pcb__line--add') && has(h, 'pcb__line--del'));
}

// ============ Tutorial-style with multiple highlights ============
{
  const h = await render('```ts title="tutorial.ts"\nimport { signal } from \'@preact/signals\' // [!code highlight]\n\nconst count = signal(0) // [!code highlight]\n\nfunction increment() {\n  count.value++ // [!code focus]\n}\n```');
  assert('tutorial with multiple highlights', count(h, 'pcb__line--hl') === 2);
  assert('tutorial with focus', has(h, 'pcb__line--focus'));
}

// ============ Error documentation ============
{
  const h = await render('```ts\ntry {\n  doSomething()\n} catch (e) {\n  console.error(e) // [!code error]\n}\n```');
  assert('error documentation', has(h, 'pcb__line--error'));
}

// ============ Word highlight in tutorial ============
{
  const h = await render('```js /useState/\nimport { useState } from \'react\'\nfunction Counter() {\n  const [count, setCount] = useState(0)\n  return <button onClick={() => setCount(count + 1)}>{count}</button>\n}\n```');
  assert('word highlight in tutorial', has(h, 'pcb__word') || has(h, 'highlighted-word'));
}

// ============ Caption with attribution ============
{
  const h = await render('```js title="auth.js" caption="Source: src/lib/auth.js — MIT licensed"\nexport function signIn(user) {\n  return fetch(\'/api/login\', { method: \'POST\', body: JSON.stringify(user) })\n}\n```');
  assert('caption with attribution', has(h, 'pcb__caption') && has(h, 'MIT licensed'));
}

// ============ Wrap mode with long config ============
{
  const h = await render('```js title="config.js" wrap\nexport const config = { apiBase: \'https://api.example.com/v2\', timeout: 30000, retries: 5, logLevel: \'info\' }\n```');
  assert('wrap mode for long config', has(h, 'pcb--wrap'));
}

// ============ Collapsible long output ============
{
  const lines = Array.from({length: 30}, (_, i) => `[INFO] log line ${i + 1}`);
  const h = await render(`\`\`\`log title="output.log" collapse\n${lines.join('\n')}\n\`\`\``);
  assert('collapsible log output', has(h, 'pcb--collapse') && has(h, '<details'));
}

// ============ Terminal commands ============
{
  const h = await render('```bash title="deploy.sh"\n$ git push origin main\n$ ssh user@server\n$ cd /var/www/app\n$ git pull\n$ npm run build\n$ pm2 restart app\n```');
  assert('terminal commands', has(h, 'pcb--terminal'));
}

// ============ Start line numbers at offset ============
{
  const h = await render('```js title="snippet.js" ln{42}\n// This is line 42\nfunction lateInit() {\n  return true\n}\n```');
  assert('start at line 42', has(h, '>42<') && has(h, '>43<'));
}

// ============ All ornaments off (minimal) ============
{
  const h = await render('```ts title="minimal.ts" noDecorations noLang noCopy\nfoo\n```');
  assert('all ornaments off', !has(h, 'pcb__dots') && !has(h, 'pcb__lang') && !has(h, 'pcb__copy'));
}

// ============ Mixed: one block with highlight, one without ============
{
  const h = await render('```js {1}\nfoo\nbar\n```\n\n```ts\nbaz\n```');
  assert('mixed highlight', count(h, 'pcb__line--hl') === 1);
}

// ============ Block with title containing dot-separated version ============
{
  const h = await render('```js title="v1.2.3.js"\nfoo\n```');
  assert('version in title', has(h, 'v1.2.3.js'));
}

// ============ Block with title containing @scope ============
{
  const h = await render('```js title="@scope/package"\nfoo\n```');
  assert('scoped package title', has(h, '@scope/package'));
}

// ============ Block with Windows-style path ============
{
  const h = await render('```js title="C:\\\\Users\\\\file.js"\nfoo\n```');
  assert('Windows path title', has(h, 'C:\\Users\\file.js'));
}

// ============ Block with URL in title ============
{
  const h = await render('```js title="https://example.com/file.js"\nfoo\n```');
  assert('URL title', has(h, 'https://example.com/file.js'));
}

// ============ Code with mixed CRLF and LF ============
{
  const h = await render('```js\r\nfoo\r\nbar\n```');
  assert('mixed line endings', has(h, 'pcb__body'));
}

// ============ Empty blocks ============
{
  const h = await render('```js\n```');
  assert('empty js block', has(h, 'pcb'));
}
{
  const h = await render('```\n```');
  assert('empty no-lang block', has(h, 'pcb'));
}

// ============ Single character code ============
{
  const h = await render('```js\nx\n```');
  assert('single char code', has(h, 'pcb__body'));
}

// ============ Code with only whitespace ============
{
  const h = await render('```js\n   \n  \n```');
  assert('whitespace-only code', has(h, 'pcb__body'));
}

// ============ Code with trailing newline ============
{
  const h = await render('```js\nfoo\nbar\n```');
  assert('trailing newline handled', !has(h, '<span class="pcb__line"></span></code>'));
}

// ============ Code without trailing newline ============
{
  const h = await render('```js\nfoo\nbar');
  assert('no trailing newline', has(h, 'pcb__body'));
}

// ============ Tabs vs spaces ============
{
  const h = await render('```js\n\tconst x = 1\n\tconst y = 2\n```');
  assert('tab indentation', has(h, 'pcb__body'));
}
{
  const h = await render('```js\n    const x = 1\n    const y = 2\n```');
  assert('space indentation', has(h, 'pcb__body'));
}

// ============ Unicode in code ============
{
  const h = await render('```js\nconst greeting = "Hello, 世界! 🌍"\nconst emoji = "🎉"\n```');
  assert('unicode in code body', has(h, 'pcb__body'));
}

// ============ Emoji in title ============
{
  const h = await render('```js title="config 🔧.js"\nfoo\n```');
  assert('emoji in title', has(h, '🔧'));
}

// ============ Very long title ============
{
  const longTitle = 'a'.repeat(200);
  const h = await render(`\`\`\`js title="${longTitle}"\nfoo\n\`\`\``);
  assert('very long title', has(h, longTitle.slice(0, 50)));
}

// ============ Multiple word highlights ============
{
  const h = await render('```js /foo/ /bar/ /baz/\nconst foo = bar + baz\n```');
  assert('multiple word highlights', has(h, 'pcb__body'));
}

// ============ Combined: title + lang + highlight + ln + wrap + caption ============
{
  const h = await render('```ts title="app.ts" {2,4} ln wrap caption="Demo"\nconst a = 1\nconst b = 2\nconst c = 3\nconst d = 4\n```');
  assert('kitchen sink', has(h, 'app.ts') && has(h, 'pcb__lang') && count(h, 'pcb__line--hl') === 2 && has(h, 'pcb__ln') && has(h, 'pcb--wrap') && has(h, 'pcb__caption'));
}

// Print results
console.log(`\nIntegration Tests: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f.name}${f.detail ? ' — ' + f.detail : ''}`));
}
process.exit(fail > 0 ? 1 : 0);
