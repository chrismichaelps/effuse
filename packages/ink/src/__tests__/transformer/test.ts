import { describe, it, expect, beforeEach } from 'vitest';
import { Predicate } from 'effect';
import {
	transformDocument,
	resetHeadingIds,
} from '../../renderer/transformer.js';
import { parseSync } from '../../parser/index.js';
import { define } from '@effuse/core';
import type { EffuseChild, ElementNode, BlueprintNode } from '@effuse/core';

const isElementNode = Predicate.isTagged('Element') as (
	node: EffuseChild
) => node is ElementNode;

const isBlueprintNode = Predicate.isTagged('Blueprint') as (
	node: EffuseChild
) => node is BlueprintNode;

describe('Transformer', () => {
	beforeEach(() => {
		resetHeadingIds();
	});

	describe('basic transformations', () => {
		it('should transform empty document to empty array', () => {
			const doc = parseSync('');
			const result = transformDocument(doc);
			expect(result).toEqual([]);
		});

		it('should transform paragraph to p element', () => {
			const doc = parseSync('Hello world');
			const result = transformDocument(doc);
			expect(result.length).toBe(1);
			const element = result[0];
			if (isElementNode(element)) {
				expect(element.tag).toBe('p');
				expect(element.props).toHaveProperty('class', 'ink-p');
			}
		});

		it('should transform heading to h1-h6 element', () => {
			const doc = parseSync('# Heading 1');
			const result = transformDocument(doc);
			const element = result[0];
			if (isElementNode(element)) {
				expect(element.tag).toBe('h1');
				expect(element.props).toHaveProperty('class', 'ink-h1');
				expect(element.props).toHaveProperty('id');
			}
		});

		it('should transform heading with generated id', () => {
			const doc = parseSync('# My Heading');
			const result = transformDocument(doc);
			const element = result[0];
			if (isElementNode(element)) {
				expect(element.props?.id).toBe('my-heading');
			}
		});

		it('should transform code block to pre > code element', () => {
			const doc = parseSync('```js\nconsole.log("hi")\n```');
			const result = transformDocument(doc);
			const pre = result[0];
			if (isElementNode(pre)) {
				expect(pre.tag).toBe('pre');
				expect(pre.props?.class).toContain('ink-code-block');
				expect(pre.props?.class).toContain('language-js');
			}
		});

		it('should transform blockquote to blockquote element', () => {
			const doc = parseSync('> Quote');
			const result = transformDocument(doc);
			const element = result[0];
			if (isElementNode(element)) {
				expect(element.tag).toBe('blockquote');
				expect(element.props?.class).toBe('ink-blockquote');
			}
		});

		it('should transform unordered list to ul element', () => {
			const doc = parseSync('- Item 1\n- Item 2');
			const result = transformDocument(doc);
			const element = result[0];
			if (isElementNode(element)) {
				expect(element.tag).toBe('ul');
				expect(element.props?.class).toBe('ink-ul');
			}
		});

		it('should transform ordered list to ol element', () => {
			const doc = parseSync('1. First\n2. Second');
			const result = transformDocument(doc);
			const element = result[0];
			if (isElementNode(element)) {
				expect(element.tag).toBe('ol');
				expect(element.props?.class).toBe('ink-ol');
			}
		});

		it('should transform horizontal rule to hr element', () => {
			const doc = parseSync('---');
			const result = transformDocument(doc);
			const element = result[0];
			if (isElementNode(element)) {
				expect(element.tag).toBe('hr');
				expect(element.props?.class).toBe('ink-hr');
			}
		});
	});

	describe('inline transformations', () => {
		it('should transform bold to strong element', () => {
			const doc = parseSync('**bold**');
			const result = transformDocument(doc);
			const p = result[0];
			if (isElementNode(p)) {
				const strong = p.children[0];
				if (isElementNode(strong)) {
					expect(strong.tag).toBe('strong');
				}
			}
		});

		it('should transform italic to em element', () => {
			const doc = parseSync('*italic*');
			const result = transformDocument(doc);
			const p = result[0];
			if (isElementNode(p)) {
				const em = p.children[0];
				if (isElementNode(em)) {
					expect(em.tag).toBe('em');
				}
			}
		});

		it('should transform inline code to code element', () => {
			const doc = parseSync('`code`');
			const result = transformDocument(doc);
			const p = result[0];
			if (isElementNode(p)) {
				const code = p.children[0];
				if (isElementNode(code)) {
					expect(code.tag).toBe('code');
					expect(code.props?.class).toBe('ink-inline-code');
				}
			}
		});

		it('should transform link to a element', () => {
			const doc = parseSync('[link](https://example.com)');
			const result = transformDocument(doc);
			const p = result[0];
			if (isElementNode(p)) {
				const a = p.children[0];
				if (isElementNode(a)) {
					expect(a.tag).toBe('a');
					expect(a.props?.href).toBe('https://example.com');
					expect(a.props?.class).toBe('ink-link');
				}
			}
		});

		it('should transform image to img element', () => {
			const doc = parseSync('![alt](https://example.com/img.png)');
			const result = transformDocument(doc);
			const p = result[0];
			if (isElementNode(p)) {
				const img = p.children[0];
				if (isElementNode(img)) {
					expect(img.tag).toBe('img');
					expect(img.props?.src).toBe('https://example.com/img.png');
					expect(img.props?.alt).toBe('alt');
					expect(img.props?.class).toBe('ink-image');
				}
			}
		});
	});

	describe('real-world document transformation', () => {
		it('should transform complete documentation page', () => {
			const markdown = `# API Reference

## Installation

\`\`\`bash
npm install my-package
\`\`\`

## Quick Start

Import the package:

\`\`\`typescript
import { create } from 'my-package';

const instance = create({
  option: true
});
\`\`\`

## Methods

### create(options)

Creates a new instance.

| Parameter | Type | Description |
|-----------|------|-------------|
| options | object | Configuration |

---

## License

MIT License
`;
			const doc = parseSync(markdown);
			const result = transformDocument(doc);

			// Should produce multiple elements
			expect(result.length).toBeGreaterThan(5);

			// Check for h1
			const h1 = result.find((el) => isElementNode(el) && el.tag === 'h1') as
				| ElementNode
				| undefined;
			expect(h1).toBeDefined();
			expect(h1?.props?.class).toBe('ink-h1');

			// Check for pre elements (code blocks)
			const pres = result.filter((el) => isElementNode(el) && el.tag === 'pre');
			expect(pres.length).toBeGreaterThan(0);
		});

		it('should transform blog post content', () => {
			const markdown = `# My Blog Post

*Published on January 1, 2024*

## Introduction

This is the **introduction** to my blog post. It contains \`inline code\` and [links](https://example.com).

## Main Content

Here's a list of points:

- First point
- Second point
- Third point

> Important quote from someone famous

## Conclusion

Thanks for reading!
`;
			const doc = parseSync(markdown);
			const result = transformDocument(doc);

			expect(result.length).toBeGreaterThan(5);
		});

		it('should transform changelog content', () => {
			const markdown = `# Changelog

## [2.0.0] - 2024-01-15

### Breaking Changes

- Removed deprecated \`oldMethod()\`
- Changed return type of \`getData()\`

### Features

- Added new \`newMethod()\` API
- Improved performance by 50%

### Bug Fixes

- Fixed memory leak in event handlers
- Fixed race condition in async operations
`;
			const doc = parseSync(markdown);
			const result = transformDocument(doc);

			expect(result.length).toBeGreaterThan(3);
		});
	});

	describe('edge cases', () => {
		it('should handle empty code blocks', () => {
			const doc = parseSync('```\n\n```');
			const result = transformDocument(doc);
			const pre = result[0];
			if (isElementNode(pre)) {
				expect(pre.tag).toBe('pre');
			}
		});

		it('should handle deeply nested structures', () => {
			const markdown = `> Level 1
> > Level 2
> > - List in quote
> > - Another item`;
			const doc = parseSync(markdown);
			const result = transformDocument(doc);
			expect(result.length).toBeGreaterThan(0);
		});

		it('should handle unicode in heading IDs', () => {
			const doc = parseSync('# 日本語 Title');
			const result = transformDocument(doc);
			const h1 = result[0];
			if (isElementNode(h1)) {
				expect(h1.props?.id).toBeDefined();
				expect(typeof h1.props?.id).toBe('string');
			}
		});

		it('should handle special characters in heading IDs', () => {
			const doc = parseSync('# What is `useState`?');
			const result = transformDocument(doc);
			const h1 = result[0];
			if (isElementNode(h1)) {
				expect(h1.props?.id).toBeDefined();
			}
		});

		it('should handle very long documents efficiently', () => {
			const paragraphs = Array.from(
				{ length: 50 },
				(_, i) => `Paragraph ${String(i + 1)} with some content.`
			).join('\n\n');
			const doc = parseSync(paragraphs);
			const result = transformDocument(doc);
			expect(result.length).toBe(50);
		});

		it('should handle mixed content types', () => {
			const markdown = `Paragraph

# Heading

\`\`\`js
code
\`\`\`

- list

> quote

---

More text`;
			const doc = parseSync(markdown);
			const result = transformDocument(doc);
			expect(result.length).toBeGreaterThan(5);
		});
	});

	describe('component mapping', () => {
		it('should render unknown component with fallback', () => {
			const doc = parseSync('::UnknownComponent{}\n\n::\n');
			const result = transformDocument(doc, {});
			const element = result[0];
			if (isElementNode(element)) {
				expect(element.tag).toBe('div');
				expect(element.props?.class).toBe('ink-unknown-component');
			}
		});
	});

	describe('heading ID uniqueness', () => {
		it('should generate unique IDs for same headings', () => {
			const doc = parseSync('# Title\n\n## Title\n\n### Title');
			const result = transformDocument(doc);

			const ids = result
				.filter(isElementNode)
				.filter((el) => el.tag && /^h[1-6]$/.test(el.tag))
				.map((el) => el.props?.id)
				.filter(Boolean);

			// All IDs should be unique
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(ids.length);
		});

		it('should reset heading IDs between documents', () => {
			const doc1 = parseSync('# Title');
			const result1 = transformDocument(doc1);

			resetHeadingIds();

			const doc2 = parseSync('# Title');
			const result2 = transformDocument(doc2);

			if (isElementNode(result1[0]) && isElementNode(result2[0])) {
				expect(result1[0].props?.id).toBe(result2[0].props?.id);
			}
		});
	});

	describe('element overrides', () => {
		it('should use custom heading component when h1 is overridden', () => {
			const calls: Record<string, unknown>[] = [];
			const CustomH1 = (props: Record<string, unknown>) => {
				calls.push(props);
				return null;
			};

			const doc = parseSync('# Hello World');
			transformDocument(doc, { h1: CustomH1 });

			expect(calls.length).toBe(1);
			expect(calls[0]).toHaveProperty('class', 'ink-h1');
			expect(calls[0]).toHaveProperty('id', 'hello-world');
		});

		it('should use custom paragraph component when p is overridden', () => {
			const calls: Record<string, unknown>[] = [];
			const CustomP = (props: Record<string, unknown>) => {
				calls.push(props);
				return null;
			};

			const doc = parseSync('Some text content');
			transformDocument(doc, { p: CustomP });

			expect(calls.length).toBe(1);
			expect(calls[0]).toHaveProperty('class', 'ink-p');
		});

		it('should use custom link component when a is overridden', () => {
			const calls: Record<string, unknown>[] = [];
			const CustomLink = (props: Record<string, unknown>) => {
				calls.push(props);
				return null;
			};

			const doc = parseSync('[click here](https://example.com)');
			transformDocument(doc, { a: CustomLink });

			expect(calls.length).toBe(1);
			expect(calls[0]).toHaveProperty('href', 'https://example.com');
			expect(calls[0]).toHaveProperty('class', 'ink-link');
		});

		it('should use custom code block components when pre/code are overridden', () => {
			const preCalls: Record<string, unknown>[] = [];
			const codeCalls: Record<string, unknown>[] = [];
			const CustomPre = (props: Record<string, unknown>) => {
				preCalls.push(props);
				return null;
			};
			const CustomCode = (props: Record<string, unknown>) => {
				codeCalls.push(props);
				return null;
			};

			const doc = parseSync('```ts\nconst x = 1;\n```');
			transformDocument(doc, { pre: CustomPre, code: CustomCode });

			expect(preCalls.length).toBe(1);
			expect(preCalls[0]).toHaveProperty('class');
			expect(codeCalls.length).toBe(1);
			expect(codeCalls[0]).toHaveProperty('data-language', 'ts');
		});

		it('should use custom blockquote component', () => {
			const calls: Record<string, unknown>[] = [];
			const CustomBlockquote = (props: Record<string, unknown>) => {
				calls.push(props);
				return null;
			};

			const doc = parseSync('> A wise quote');
			transformDocument(doc, { blockquote: CustomBlockquote });

			expect(calls.length).toBe(1);
			expect(calls[0]).toHaveProperty('class', 'ink-blockquote');
		});

		it('should use custom list components when ul/li are overridden', () => {
			const ulCalls: Record<string, unknown>[] = [];
			const liCalls: Record<string, unknown>[] = [];
			const CustomUl = (props: Record<string, unknown>) => {
				ulCalls.push(props);
				return null;
			};
			const CustomLi = (props: Record<string, unknown>) => {
				liCalls.push(props);
				return null;
			};

			const doc = parseSync('- Apple\n- Banana');
			transformDocument(doc, { ul: CustomUl, li: CustomLi });

			expect(ulCalls.length).toBe(1);
			expect(liCalls.length).toBe(2);
		});

		it('should use custom hr component', () => {
			const calls: Record<string, unknown>[] = [];
			const CustomHr = (props: Record<string, unknown>) => {
				calls.push(props);
				return null;
			};

			const doc = parseSync('---');
			transformDocument(doc, { hr: CustomHr });

			expect(calls.length).toBe(1);
			expect(calls[0]).toHaveProperty('class', 'ink-hr');
		});

		it('should use custom strong/em components for emphasis', () => {
			const strongCalls: Record<string, unknown>[] = [];
			const emCalls: Record<string, unknown>[] = [];
			const CustomStrong = (props: Record<string, unknown>) => {
				strongCalls.push(props);
				return null;
			};
			const CustomEm = (props: Record<string, unknown>) => {
				emCalls.push(props);
				return null;
			};

			const doc = parseSync('**bold** and *italic*');
			transformDocument(doc, { strong: CustomStrong, em: CustomEm });

			expect(strongCalls.length).toBe(1);
			expect(emCalls.length).toBe(1);
		});

		it('should mix element overrides with custom components', () => {
			const h1Calls: Record<string, unknown>[] = [];
			const CustomH1 = (props: Record<string, unknown>) => {
				h1Calls.push(props);
				return null;
			};

			const doc = parseSync('# Heading\n\nRegular paragraph');
			const result = transformDocument(doc, { h1: CustomH1 });

			expect(h1Calls.length).toBe(1);
			const pElement = result[1];
			if (isElementNode(pElement)) {
				expect(pElement.tag).toBe('p');
			}
		});

		it('should fall back to default elements when no override is provided', () => {
			const doc = parseSync('# Default Heading\n\nDefault paragraph');
			const result = transformDocument(doc, {});

			const h1 = result[0];
			const p = result[1];
			if (isElementNode(h1)) {
				expect(h1.tag).toBe('h1');
			}
			if (isElementNode(p)) {
				expect(p.tag).toBe('p');
			}
		});

		it('should override table elements', () => {
			const thCalls: Record<string, unknown>[] = [];
			const CustomTh = (props: Record<string, unknown>) => {
				thCalls.push(props);
				return null;
			};

			const markdown = '| Col1 | Col2 |\n|------|------|\n| A | B |';
			const doc = parseSync(markdown);
			transformDocument(doc, { th: CustomTh });

			expect(thCalls.length).toBe(2);
		});

		it('should override image element', () => {
			const calls: Record<string, unknown>[] = [];
			const CustomImg = (props: Record<string, unknown>) => {
				calls.push(props);
				return null;
			};

			const doc = parseSync('![alt text](https://example.com/img.png)');
			transformDocument(doc, { img: CustomImg });

			expect(calls.length).toBe(1);
			expect(calls[0]).toHaveProperty('src', 'https://example.com/img.png');
			expect(calls[0]).toHaveProperty('alt', 'alt text');
		});

		it('should support define() blueprint components as overrides', () => {
			const CustomHeading = define<{ class?: string; id?: string }>({
				name: 'CustomHeading',
				script: () => ({}),
				template: () => null,
			});

			const doc = parseSync('# Hello World');
			const result = transformDocument(doc, { h1: CustomHeading });

			expect(result.length).toBe(1);
			const node = result[0];
			expect(isBlueprintNode(node)).toBe(true);
			if (isBlueprintNode(node)) {
				expect(node.props).toHaveProperty('class', 'ink-h1');
				expect(node.props).toHaveProperty('id', 'hello-world');
			}
		});
	});
});
