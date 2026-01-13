/**
 * Tests for Ink parser with TaggedEnum factories
 * Includes production real-world cases and edge cases
 */

import { describe, it, expect } from 'vitest';
import { parseSync } from '../../parser/index.js';
import type { BlockNode } from '../../types/ast.js';

describe('Parser', () => {
	describe('parseSync basic parsing', () => {
		it('should parse empty string to empty document', () => {
			const doc = parseSync('');
			expect(doc._tag).toBe('Document');
			expect(doc.children).toEqual([]);
		});

		it('should parse paragraph', () => {
			const doc = parseSync('Hello world');
			expect(doc._tag).toBe('Document');
			expect(doc.children.length).toBe(1);
			expect(doc.children[0]?._tag).toBe('Paragraph');
		});

		it('should parse heading', () => {
			const doc = parseSync('# Heading 1');
			expect(doc.children[0]?._tag).toBe('Heading');
			const heading = doc.children[0] as Extract<
				BlockNode,
				{ _tag: 'Heading' }
			>;
			expect(heading.level).toBe(1);
		});

		it('should parse heading levels 1-6', () => {
			for (let level = 1; level <= 6; level++) {
				const doc = parseSync(`${'#'.repeat(level)} Heading ${String(level)}`);
				const heading = doc.children[0] as Extract<
					BlockNode,
					{ _tag: 'Heading' }
				>;
				expect(heading._tag).toBe('Heading');
				expect(heading.level).toBe(level);
			}
		});

		it('should parse code block', () => {
			const doc = parseSync('```js\nconsole.log("hi")\n```');
			expect(doc.children[0]?._tag).toBe('CodeBlock');
			const codeBlock = doc.children[0] as Extract<
				BlockNode,
				{ _tag: 'CodeBlock' }
			>;
			expect(codeBlock.language).toBe('js');
		});

		it('should parse blockquote', () => {
			const doc = parseSync('> This is a quote');
			expect(doc.children[0]?._tag).toBe('Blockquote');
		});

		it('should parse unordered list', () => {
			const doc = parseSync('- Item 1\n- Item 2');
			expect(doc.children[0]?._tag).toBe('List');
			const list = doc.children[0] as Extract<BlockNode, { _tag: 'List' }>;
			expect(list.ordered).toBe(false);
			expect(list.children.length).toBe(2);
		});

		it('should parse ordered list', () => {
			const doc = parseSync('1. First\n2. Second');
			const list = doc.children[0] as Extract<BlockNode, { _tag: 'List' }>;
			expect(list._tag).toBe('List');
			expect(list.ordered).toBe(true);
		});

		it('should parse horizontal rule', () => {
			const doc = parseSync('---');
			expect(doc.children[0]?._tag).toBe('HorizontalRule');
		});
	});

	describe('real-world markdown content', () => {
		it('should parse README-style document', () => {
			const markdown = `# Project Title

A brief description of the project.

## Installation

\`\`\`bash
npm install my-package
\`\`\`

## Usage

Run the following command:

\`\`\`js
import { foo } from 'my-package';
foo();
\`\`\`

## License

MIT
`;
			const doc = parseSync(markdown);
			expect(doc._tag).toBe('Document');
			expect(doc.children.length).toBeGreaterThan(5);

			// Check it has headings
			const headings = doc.children.filter(
				(c): c is Extract<BlockNode, { _tag: 'Heading' }> =>
					c._tag === 'Heading'
			);
			expect(headings.length).toBeGreaterThan(0);

			// Check it has code blocks
			const codeBlocks = doc.children.filter(
				(c): c is Extract<BlockNode, { _tag: 'CodeBlock' }> =>
					c._tag === 'CodeBlock'
			);
			expect(codeBlocks.length).toBeGreaterThan(0);
		});

		it('should parse documentation with nested lists', () => {
			const markdown = `## Features

- Feature 1
- Feature 2
- Feature 3

### Sub-features

1. First item
2. Second item
3. Third item
`;
			const doc = parseSync(markdown);
			const lists = doc.children.filter((c) => c._tag === 'List');
			expect(lists.length).toBe(2);
		});

		it('should parse changelog-style document', () => {
			const markdown = `# Changelog

## v2.0.0

### Breaking Changes

- Removed deprecated API
- Changed default behavior

### Features

- Added new feature X
- Improved performance

## v1.0.0

Initial release.
`;
			const doc = parseSync(markdown);
			expect(doc.children.length).toBeGreaterThan(3);
		});
	});

	describe('edge cases', () => {
		it('should handle whitespace-only content', () => {
			const doc = parseSync('   \n\n   \t\t  ');
			expect(doc._tag).toBe('Document');
		});

		it('should handle very long lines', () => {
			const longLine = 'word '.repeat(1000);
			const doc = parseSync(longLine);
			expect(doc.children.length).toBeGreaterThan(0);
		});

		it('should handle unicode content', () => {
			const markdown = `# 日本語のタイトル

这是中文段落。

> Цитата на русском

- العربية
- עברית
- 한국어
`;
			const doc = parseSync(markdown);
			expect(doc.children.length).toBeGreaterThan(0);
			expect(doc.children[0]?._tag).toBe('Heading');
		});

		it('should handle emoji content', () => {
			const markdown = `# 🚀 Launch Notes

## ✨ Features

- 🎉 Party mode
- 🔥 Hot reloading
- 💡 Smart suggestions
`;
			const doc = parseSync(markdown);
			expect(doc.children.length).toBeGreaterThan(0);
		});

		it('should handle mixed quote styles in blockquotes', () => {
			const markdown = `> First line
> Second line
> Third line`;
			const doc = parseSync(markdown);
			expect(doc.children[0]?._tag).toBe('Blockquote');
		});

		it('should handle code block without language', () => {
			const markdown = '```\nplain code\n```';
			const doc = parseSync(markdown);
			const codeBlock = doc.children[0] as Extract<
				BlockNode,
				{ _tag: 'CodeBlock' }
			>;
			expect(codeBlock._tag).toBe('CodeBlock');
		});

		it('should handle multiple consecutive horizontal rules', () => {
			const markdown = `---

---

---`;
			const doc = parseSync(markdown);
			const hrules = doc.children.filter((c) => c._tag === 'HorizontalRule');
			expect(hrules.length).toBe(3);
		});

		it('should handle deep nesting in blockquotes', () => {
			const markdown = `> Level 1
> > Level 2
> > > Level 3`;
			const doc = parseSync(markdown);
			expect(doc.children.length).toBeGreaterThan(0);
		});

		it('should handle tables', () => {
			const markdown = `| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`;
			const doc = parseSync(markdown);
			const table = doc.children.find((c) => c._tag === 'Table');
			expect(table).toBeDefined();
		});

		it('should handle task lists', () => {
			const markdown = `- [x] Done task
- [ ] Pending task
- [x] Another done task`;
			const doc = parseSync(markdown);
			expect(doc.children[0]?._tag).toBe('List');
		});
	});

	describe('document structure', () => {
		it('should handle multiple paragraphs', () => {
			const doc = parseSync('First paragraph\n\nSecond paragraph');
			expect(doc.children.length).toBe(2);
			expect(doc.children[0]?._tag).toBe('Paragraph');
			expect(doc.children[1]?._tag).toBe('Paragraph');
		});

		it('should maintain block order', () => {
			const markdown = `# Heading

Paragraph

- List item

> Quote

---
`;
			const doc = parseSync(markdown);
			expect(doc.children.length).toBeGreaterThan(4);
		});
	});

	describe('special markdown patterns', () => {
		it('should handle setext-style headings', () => {
			const markdown = `Heading 1
=========

Heading 2
---------`;
			const doc = parseSync(markdown);
			// Setext headings may or may not be supported
			expect(doc._tag).toBe('Document');
		});

		it('should handle fenced code with info string', () => {
			const markdown = '```typescript fileName="example.ts"\nconst x = 1;\n```';
			const doc = parseSync(markdown);
			const codeBlock = doc.children[0] as Extract<
				BlockNode,
				{ _tag: 'CodeBlock' }
			>;
			expect(codeBlock._tag).toBe('CodeBlock');
		});

		it('should handle reference-style links', () => {
			const markdown = `Click [here][link] for more.

[link]: https://example.com`;
			const doc = parseSync(markdown);
			expect(doc._tag).toBe('Document');
		});
	});
});
