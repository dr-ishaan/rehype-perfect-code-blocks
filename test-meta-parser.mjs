/**
 * Test Suite: Meta Parser (src/meta.ts)
 * Comprehensive tests for the fence-meta parser.
 * Target: 120+ tests covering every meta syntax combination.
 */

import { parseMeta } from '../rehype-perfect-code-blocks/dist/meta.js';

let pass = 0, fail = 0;
const failures = [];

function assert(name, actual, expected) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    pass++;
  } else {
    fail++;
    failures.push({ name, actual: actualStr, expected: expectedStr });
  }
}

function assertIncludes(name, arr, item) {
  if (Array.isArray(arr) && arr.includes(item)) pass++;
  else { fail++; failures.push({ name, actual: JSON.stringify(arr), expected: `includes ${item}` }); }
}

function assertNull(name, val) {
  if (val === null) pass++;
  else { fail++; failures.push({ name, actual: JSON.stringify(val), expected: 'null' }); }
}

function assertNotEmpty(name, val) {
  if (Array.isArray(val) ? val.length > 0 : !!val) pass++;
  else { fail++; failures.push({ name, actual: JSON.stringify(val), expected: 'non-empty' }); }
}

// ============ Empty / undefined input ============
assert('undefined meta', parseMeta(undefined).title, null);
assert('empty string meta', parseMeta('').title, null);
assert('whitespace-only meta', parseMeta('   ').title, null);
assert('tab-only meta', parseMeta('\t').title, null);

// ============ title="..." ============
assert('simple title', parseMeta('title="app.js"').title, 'app.js');
assert('title with spaces', parseMeta('title="my app.js"').title, 'my app.js');
assert('title with path', parseMeta('title="src/components/Button.tsx"').title, 'src/components/Button.tsx');
assert('title with dots', parseMeta('title="../../up/dir.js"').title, '../../up/dir.js');
assert('title empty value', parseMeta('title=""').title, '');
assert('title single quotes', parseMeta("title='app.js'").title, 'app.js');
assert('title single with apostrophe', parseMeta("title='it\\'s a file.js'").title, "it's a file.js");
assert('title with equals sign', parseMeta('title="x=y.js"').title, 'x=y.js');
assert('title with special chars', parseMeta('title="a@b#c.js"').title, 'a@b#c.js');
assert('title with unicode', parseMeta('title="文件.js"').title, '文件.js');
assert('title with emoji', parseMeta('title="config 🔧.js"').title, 'config 🔧.js');
assert('title unquoted', parseMeta('title=app.js').title, 'app.js');
assert('title unquoted with dash', parseMeta('title=my-file.js').title, 'my-file.js');
assert('title unquoted with dots', parseMeta('title=v1.2.3.js').title, 'v1.2.3.js');

// ============ caption="..." ============
assert('simple caption', parseMeta('caption="Source: MIT"').caption, 'Source: MIT');
assert('caption empty', parseMeta('caption=""').caption, '');
assert('caption single quotes', parseMeta("caption='hi'").caption, 'hi');
assert('caption with special chars', parseMeta('caption="© 2025"').caption, '© 2025');
assert('caption with colon', parseMeta('caption="Note: see docs"').caption, 'Note: see docs');

// ============ {range} highlighting ============
assertIncludes('single line', parseMeta('{1}').highlight, 1);
assertIncludes('line 5', parseMeta('{5}').highlight, 5);
assertIncludes('range 2-4 contains 2', parseMeta('{2-4}').highlight, 2);
assertIncludes('range 2-4 contains 3', parseMeta('{2-4}').highlight, 3);
assertIncludes('range 2-4 contains 4', parseMeta('{2-4}').highlight, 4);
assert('range 2-4 has exactly 3 lines', parseMeta('{2-4}').highlight.length, 3);
assertIncludes('multi {1,3,5} has 1', parseMeta('{1,3,5}').highlight, 1);
assertIncludes('multi {1,3,5} has 3', parseMeta('{1,3,5}').highlight, 3);
assertIncludes('multi {1,3,5} has 5', parseMeta('{1,3,5}').highlight, 5);
assert('multi {1,3,5} has exactly 3', parseMeta('{1,3,5}').highlight.length, 3);
assertIncludes('reverse range {5-1}', parseMeta('{5-1}').highlight, 1);
assertIncludes('reverse range {5-1} has 5', parseMeta('{5-1}').highlight, 5);
assert('reverse range has 5 lines', parseMeta('{5-1}').highlight.length, 5);
assertIncludes('unordered {5,2,8} has 2', parseMeta('{5,2,8}').highlight, 2);
assertIncludes('unordered {5,2,8} has 5', parseMeta('{5,2,8}').highlight, 5);
assertIncludes('unordered {5,2,8} has 8', parseMeta('{5,2,8}').highlight, 8);
assertIncludes('overlap {1-5,3-7} has 1', parseMeta('{1-5,3-7}').highlight, 1);
assertIncludes('overlap {1-5,3-7} has 4', parseMeta('{1-5,3-7}').highlight, 4);
assertIncludes('overlap {1-5,3-7} has 7', parseMeta('{1-5,3-7}').highlight, 7);
assert('overlap dedupes', parseMeta('{1-5,3-7}').highlight.length, 7);
assert('spaces in ranges {1, 3, 5}', parseMeta('{1, 3, 5}').highlight.length, 3);
assert('range with internal spaces {2-4}', parseMeta('{2-4}').highlight.length, 3);
assert('range with space after comma {1, 2-4, 6}', parseMeta('{1, 2-4, 6}').highlight.length, 5);
assert('single line 100', parseMeta('{100}').highlight.includes(100), true);
assert('range 99-101', parseMeta('{99-101}').highlight.length, 3);
assert('out of order ranges {5-7,1-3}', parseMeta('{5-7,1-3}').highlight.length, 6);
assert('duplicate lines {1,1,1}', parseMeta('{1,1,1}').highlight.length, 1);
assert('duplicate ranges {2-4,2-4}', parseMeta('{2-4,2-4}').highlight.length, 3);
assert('zero line {0}', parseMeta('{0}').highlight.length, 1);
assert('very large line', parseMeta('{999999}').highlight.includes(999999), true);

// ============ {range}#id grouping ============
const grouped = parseMeta('{1,2}#a {3,4}#b');
assert('group A has lines 1,2', grouped.highlightGroups[0].lines.length, 2);
assert('group A id', grouped.highlightGroups[0].id, 'a');
assert('group B has lines 3,4', grouped.highlightGroups[1].lines.length, 2);
assert('group B id', grouped.highlightGroups[1].id, 'b');
const singleGroup = parseMeta('{5-7}#focus');
assert('single group id', singleGroup.highlightGroups[0].id, 'focus');
assert('single group has 3 lines', singleGroup.highlightGroups[0].lines.length, 3);

// ============ /word/ word highlighting ============
assert('simple /word/', parseMeta('/foo/').wordHighlights[0].text, 'foo');
assert('/word/ with range', parseMeta('/foo/1-3').wordHighlights[0].text, 'foo');
assert('/word/ range start', parseMeta('/foo/2-4').wordHighlights[0].range[0], 2);
assert('/word/ range end', parseMeta('/foo/2-4').wordHighlights[0].range[1], 4);
assert('/word/ single occurrence', parseMeta('/foo/3').wordHighlights[0].range[0], 3);
assert('/word/ with id', parseMeta('/foo/#v1').wordHighlights[0].id, 'v1');
assert('multiple words /a/ /b/', parseMeta('/a/ /b/').wordHighlights.length, 2);
assert('word with dots', parseMeta('/foo.bar/').wordHighlights[0].text, 'foo.bar');
assert('word with underscores', parseMeta('/my_var/').wordHighlights[0].text, 'my_var');
assert('word with hyphens', parseMeta('/my-var/').wordHighlights[0].text, 'my-var');
assert('word with numbers', parseMeta('/var123/').wordHighlights[0].text, 'var123');
assert('word with special chars', parseMeta('/a+b/').wordHighlights[0].text, 'a+b');
assert('escaped slash in word', parseMeta('/a\\/b/').wordHighlights[0].text, 'a/b');
assert('empty word //', parseMeta('///').wordHighlights[0].text, '');

// ============ "phrase" highlighting ============
assert('simple "phrase"', parseMeta('"myVar"').wordHighlights[0].text, 'myVar');
assert('"phrase" with spaces', parseMeta('"hello world"').wordHighlights[0].text, 'hello world');
assert('"phrase" with range', parseMeta('"foo"2-3').wordHighlights[0].text, 'foo');
assert('"phrase" with id', parseMeta('"foo"#v1').wordHighlights[0].id, 'v1');

// ============ ln{N} / showLineNumbers{N} ============
assert('ln{5} start', parseMeta('ln{5}').lineNumbersStart, 5);
assert('ln{1} start', parseMeta('ln{1}').lineNumbersStart, 1);
assert('ln{100} start', parseMeta('ln{100}').lineNumbersStart, 100);
assert('showLineNumbers{5} start', parseMeta('showLineNumbers{5}').lineNumbersStart, 5);
assert('ShowLineNumbers{10} case insensitive', parseMeta('ShowLineNumbers{10}').lineNumbersStart, 10);
assert('SHOWLINENUMBERS{1} uppercase', parseMeta('SHOWLINENUMBERS{1}').lineNumbersStart, 1);
assert('ln{5} enables line numbers', parseMeta('ln{5}').flags.lineNumbers, true);

// ============ Boolean flags ============
assert('wrap flag', parseMeta('wrap').flags.wrap, true);
assert('noWrap flag', parseMeta('noWrap').flags.wrap, false);
assert('ln flag', parseMeta('ln').flags.lineNumbers, true);
assert('noLn flag', parseMeta('noLn').flags.lineNumbers, false);
assert('showLineNumbers flag', parseMeta('showLineNumbers').flags.lineNumbers, true);
assert('noShowLineNumbers flag', parseMeta('noShowLineNumbers').flags.lineNumbers, false);
assert('linenos flag', parseMeta('linenos').flags.lineNumbers, true);
assert('noLinenos flag', parseMeta('noLinenos').flags.lineNumbers, false);
assert('bar flag', parseMeta('bar').flags.titleBar, true);
assert('noBar flag', parseMeta('noBar').flags.titleBar, false);
assert('decorations flag', parseMeta('decorations').flags.decorations, true);
assert('noDecorations flag', parseMeta('noDecorations').flags.decorations, false);
assert('lang flag', parseMeta('lang').flags.showLanguage, true);
assert('noLang flag', parseMeta('noLang').flags.showLanguage, false);
assert('copy flag', parseMeta('copy').flags.copyButton, true);
assert('noCopy flag', parseMeta('noCopy').flags.copyButton, false);
assert('collapse flag', parseMeta('collapse').flags.collapse, true);
assert('noCollapse flag', parseMeta('noCollapse').flags.collapse, false);

// Case-insensitive flags
assert('WRAP uppercase', parseMeta('WRAP').flags.wrap, true);
assert('Wrap mixed case', parseMeta('Wrap').flags.wrap, true);
assert('LN uppercase', parseMeta('LN').flags.lineNumbers, true);
assert('NOLN uppercase', parseMeta('NOLN').flags.lineNumbers, false);

// ============ Combined meta ============
const combined = parseMeta('title="app.ts" {1,3-5} /foo/ ln{10} wrap noLang caption="hi"');
assert('combined title', combined.title, 'app.ts');
assert('combined has 4 highlights', combined.highlight.length, 4);
assert('combined word', combined.wordHighlights[0].text, 'foo');
assert('combined start', combined.lineNumbersStart, 10);
assert('combined wrap', combined.flags.wrap, true);
assert('combined noLang', combined.flags.showLanguage, false);
assert('combined caption', combined.caption, 'hi');

// ============ Unknown tokens ignored ============
const unknown = parseMeta('title="x.js" fooBar baz=42 {1} unknownFlag');
assert('unknown title preserved', unknown.title, 'x.js');
assert('unknown highlight preserved', unknown.highlight.length, 1);

// ============ Malformed input ============
assert('unclosed title returns partial', parseMeta('title="unclosed').title, '"unclosed');
assertNull('unclosed brace', parseMeta('{1,2').title);
assert('unclosed brace no highlight', parseMeta('{1,2').highlight.length, 0);
assert('title= no value returns empty string', parseMeta('title=').title, '');
assert('lone opening brace', parseMeta('{').highlight.length, 0);
assert('lone closing brace', parseMeta('}').highlight.length, 0);
assert('empty braces', parseMeta('{}').highlight.length, 0);
assert('braces with just comma', parseMeta('{,}').highlight.length, 0);
assert('braces with non-numeric', parseMeta('{abc}').highlight.length, 0);
assert('braces with mixed valid invalid', parseMeta('{1,abc,3}').highlight.length, 2);
assert('braces with negative', parseMeta('{-1}').highlight.length, 0);
assert('braces with float', parseMeta('{1.5}').highlight.length, 0);
assert('braces with zero-prefixed', parseMeta('{01}').highlight.includes(1), true);

// ============ Multiple titles (last wins) ============
assert('multiple titles last wins', parseMeta('title="a.js" title="b.js"').title, 'b.js');

// ============ Multiple captions ============
assert('multiple captions last wins', parseMeta('caption="a" caption="b"').caption, 'b');

// ============ Order independence ============
const order1 = parseMeta('{1} title="x"');
const order2 = parseMeta('title="x" {1}');
assert('order independence title', order1.title, order2.title);
assert('order independence highlight', order1.highlight.length, order2.highlight.length);

// ============ Whitespace handling ============
assert('extra spaces', parseMeta('  title="x"  {1}  ').title, 'x');
assert('tabs between tokens', parseMeta('title="x"\t{1}').title, 'x');
assert('newlines between tokens', parseMeta('title="x"\n{1}').title, 'x');
assert('multiple spaces in ranges', parseMeta('{  1  ,  2  }').highlight.length, 2);

// ============ Word with regex special chars ============
assert('word with parens', parseMeta('/foo()/').wordHighlights[0].text, 'foo()');
assert('word with brackets', parseMeta('/foo[]/').wordHighlights[0].text, 'foo[]');
assert('word with braces', parseMeta('/foo{}/').wordHighlights[0].text, 'foo{}');
assert('word with caret', parseMeta('/foo^/').wordHighlights[0].text, 'foo^');
assert('word with dollar', parseMeta('/foo$/').wordHighlights[0].text, 'foo$');
assert('word with star', parseMeta('/foo*/').wordHighlights[0].text, 'foo*');

// ============ Mixed quote styles ============
assert('single then double', parseMeta("title='a' caption=\"b\"").title, 'a');
assert('double then single', parseMeta('title="a" caption=\'b\'').caption, 'b');

// ============ Long inputs ============
const longTitle = 'a'.repeat(1000);
assert('very long title', parseMeta(`title="${longTitle}"`).title, longTitle);
const manyLines = Array.from({length: 100}, (_, i) => i + 1).join(',');
assert('100 lines highlighted', parseMeta(`{${manyLines}}`).highlight.length, 100);

// ============ Special filename patterns ============
assert('title with Windows path', parseMeta('title="C:\\\\Users\\\\file.js"').title, 'C:\\Users\\file.js');
assert('title with URL', parseMeta('title="https://example.com/file.js"').title, 'https://example.com/file.js');
assert('title with query string', parseMeta('title="?query=1"').title, '?query=1');
assert('title with hash', parseMeta('title="#section"').title, '#section');
assert('title with brackets', parseMeta('title="[id].js"').title, '[id].js');
assert('title with parens', parseMeta('title="(index).js"').title, '(index).js');
assert('title with at sign', parseMeta('title="@scope/pkg"').title, '@scope/pkg');

// ============ Edge cases with #id ============
assert('id with dash', parseMeta('{1}#my-id').highlightGroups[0].id, 'my-id');
assert('id with underscore', parseMeta('{1}#my_id').highlightGroups[0].id, 'my_id');
assert('id with numbers', parseMeta('{1}#group123').highlightGroups[0].id, 'group123');
assert('id with mixed case', parseMeta('{1}#MyGroup').highlightGroups[0].id, 'MyGroup');

// ============ Word with #id combinations ============
assert('/word/#id', parseMeta('/foo/#v1').wordHighlights[0].id, 'v1');
assert('/word/N#id', parseMeta('/foo/2#v1').wordHighlights[0].id, 'v1');
assert('/word/N-M#id', parseMeta('/foo/2-4#v1').wordHighlights[0].id, 'v1');
assert('"phrase"#id', parseMeta('"foo"#v1').wordHighlights[0].id, 'v1');

// Print results
console.log(`\nMeta Parser Tests: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  ✗ ${f.name}\n    expected: ${f.expected}\n    actual:   ${f.actual}`));
}
process.exit(fail > 0 ? 1 : 0);
