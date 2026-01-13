import { describe, it, expect } from 'vitest';
import {
	TextNode,
	InlineCodeNode,
	EmphasisNode,
	LinkNode,
	ImageNode,
	LineBreakNode,
	HeadingNode,
	ParagraphNode,
	CodeBlockNode,
	BlockquoteNode,
	ListNode,
	HorizontalRuleNode,
	TableNode,
	ComponentNode,
	ListItemNode,
	TableRowNode,
	TableCellNode,
	DocumentNode,
	InlineNode$is,
	BlockNode$is,
} from '../../types/ast.js';

describe('InlineNode TaggedEnum', () => {
	describe('factory functions', () => {
		it('should create TextNode with correct _tag', () => {
			const node = TextNode({ value: 'Hello' });
			expect(node._tag).toBe('Text');
			expect(node.value).toBe('Hello');
		});

		it('should create InlineCodeNode with correct _tag', () => {
			const node = InlineCodeNode({ value: 'const x = 1' });
			expect(node._tag).toBe('InlineCode');
			expect(node.value).toBe('const x = 1');
		});

		it('should create EmphasisNode with correct _tag and style', () => {
			const boldNode = EmphasisNode({ style: 'bold', children: [] });
			expect(boldNode._tag).toBe('Emphasis');
			expect(boldNode.style).toBe('bold');

			const italicNode = EmphasisNode({ style: 'italic', children: [] });
			expect(italicNode.style).toBe('italic');

			const strikeNode = EmphasisNode({ style: 'strikethrough', children: [] });
			expect(strikeNode.style).toBe('strikethrough');
		});

		it('should create LinkNode with correct _tag', () => {
			const node = LinkNode({
				url: 'https://example.com',
				title: 'Example',
				children: [],
			});
			expect(node._tag).toBe('Link');
			expect(node.url).toBe('https://example.com');
			expect(node.title).toBe('Example');
		});

		it('should create ImageNode with correct _tag', () => {
			const node = ImageNode({
				url: 'https://example.com/image.png',
				alt: 'Alt text',
			});
			expect(node._tag).toBe('Image');
			expect(node.url).toBe('https://example.com/image.png');
			expect(node.alt).toBe('Alt text');
		});

		it('should create LineBreakNode with correct _tag', () => {
			const node = LineBreakNode({});
			expect(node._tag).toBe('LineBreak');
		});
	});

	describe('$is type guard', () => {
		it('should correctly identify Text nodes', () => {
			const textNode = TextNode({ value: 'test' });
			expect(InlineNode$is('Text')(textNode)).toBe(true);
			expect(InlineNode$is('InlineCode')(textNode)).toBe(false);
		});

		it('should correctly identify Emphasis nodes', () => {
			const emphasisNode = EmphasisNode({ style: 'bold', children: [] });
			expect(InlineNode$is('Emphasis')(emphasisNode)).toBe(true);
			expect(InlineNode$is('Text')(emphasisNode)).toBe(false);
		});
	});

	describe('real-world edge cases', () => {
		it('should handle empty text value', () => {
			const node = TextNode({ value: '' });
			expect(node.value).toBe('');
		});

		it('should handle unicode characters in text', () => {
			const node = TextNode({ value: '你好世界 🌍 مرحبا العالم' });
			expect(node.value).toBe('你好世界 🌍 مرحبا العالم');
		});

		it('should handle special characters in URLs', () => {
			const node = LinkNode({
				url: 'https://example.com/path?query=value&foo=bar#section',
				children: [],
			});
			expect(node.url).toBe(
				'https://example.com/path?query=value&foo=bar#section'
			);
		});

		it('should handle very long text values', () => {
			const longText = 'a'.repeat(10000);
			const node = TextNode({ value: longText });
			expect(node.value.length).toBe(10000);
		});

		it('should handle newlines and special whitespace in text', () => {
			const node = TextNode({ value: 'line1\nline2\ttabbed' });
			expect(node.value).toBe('line1\nline2\ttabbed');
		});

		it('should handle nested emphasis children', () => {
			const innerText = TextNode({ value: 'nested' });
			const boldNode = EmphasisNode({
				style: 'bold',
				children: [innerText],
			});
			expect(boldNode.children).toHaveLength(1);
		});
	});
});

describe('BlockNode TaggedEnum', () => {
	describe('factory functions', () => {
		it('should create HeadingNode with correct _tag and level', () => {
			const node = HeadingNode({ level: 2, children: [] });
			expect(node._tag).toBe('Heading');
			expect(node.level).toBe(2);
		});

		it('should create ParagraphNode with correct _tag', () => {
			const node = ParagraphNode({ children: [] });
			expect(node._tag).toBe('Paragraph');
		});

		it('should create CodeBlockNode with correct _tag', () => {
			const node = CodeBlockNode({ code: 'console.log("hi")', language: 'js' });
			expect(node._tag).toBe('CodeBlock');
			expect(node.code).toBe('console.log("hi")');
			expect(node.language).toBe('js');
		});

		it('should create BlockquoteNode with correct _tag', () => {
			const node = BlockquoteNode({ children: [] });
			expect(node._tag).toBe('Blockquote');
		});

		it('should create ListNode with correct _tag and ordered flag', () => {
			const orderedList = ListNode({ ordered: true, children: [] });
			expect(orderedList._tag).toBe('List');
			expect(orderedList.ordered).toBe(true);

			const unorderedList = ListNode({ ordered: false, children: [] });
			expect(unorderedList.ordered).toBe(false);
		});

		it('should create HorizontalRuleNode with correct _tag', () => {
			const node = HorizontalRuleNode({});
			expect(node._tag).toBe('HorizontalRule');
		});

		it('should create TableNode with correct _tag', () => {
			const header = TableRowNode({ cells: [] });
			const node = TableNode({ header, rows: [], alignments: [] });
			expect(node._tag).toBe('Table');
		});

		it('should create ComponentNode with correct _tag', () => {
			const node = ComponentNode({
				name: 'MyComponent',
				props: { foo: 'bar' },
				children: [],
				slots: {},
				selfClosing: true,
			});
			expect(node._tag).toBe('Component');
			expect(node.name).toBe('MyComponent');
			expect(node.props).toEqual({ foo: 'bar' });
		});
	});

	describe('$is type guard', () => {
		it('should correctly identify Heading nodes', () => {
			const headingNode = HeadingNode({ level: 1, children: [] });
			expect(BlockNode$is('Heading')(headingNode)).toBe(true);
			expect(BlockNode$is('Paragraph')(headingNode)).toBe(false);
		});

		it('should correctly identify CodeBlock nodes', () => {
			const codeNode = CodeBlockNode({ code: 'x', language: 'js' });
			expect(BlockNode$is('CodeBlock')(codeNode)).toBe(true);
		});
	});

	describe('real-world edge cases', () => {
		it('should handle code blocks with no language', () => {
			const node = CodeBlockNode({ code: 'plain text' });
			expect(node.language).toBeUndefined();
		});

		it('should handle code blocks with unusual languages', () => {
			const node = CodeBlockNode({
				code: 'content',
				language: 'dockerfile',
			});
			expect(node.language).toBe('dockerfile');
		});

		it('should handle very deep nested blockquotes', () => {
			const innerPara = ParagraphNode({ children: [] });
			const innerQuote = BlockquoteNode({ children: [innerPara] });
			const outerQuote = BlockquoteNode({ children: [innerQuote] });
			expect(outerQuote.children).toHaveLength(1);
			expect(outerQuote.children[0]?._tag).toBe('Blockquote');
		});

		it('should handle list with mixed item types', () => {
			const taskItem = ListItemNode({ checked: true, children: [] });
			const regularItem = ListItemNode({ children: [] });
			const list = ListNode({
				ordered: false,
				children: [taskItem, regularItem],
			});
			expect(list.children).toHaveLength(2);
		});

		it('should handle ComponentNode with complex props', () => {
			const node = ComponentNode({
				name: 'DataGrid',
				props: {
					columns: ['id', 'name', 'value'],
					sortable: true,
					pageSize: 50,
					onRowClick: 'handleClick',
				},
				children: [],
				slots: {
					header: [],
					footer: [],
				},
				selfClosing: false,
			});
			expect(node.props.columns).toHaveLength(3);
			expect(Object.keys(node.slots)).toHaveLength(2);
		});

		it('should handle table with multiple alignments', () => {
			const header = TableRowNode({
				cells: [
					TableCellNode({ children: [] }),
					TableCellNode({ children: [] }),
					TableCellNode({ children: [] }),
				],
			});
			const node = TableNode({
				header,
				rows: [],
				alignments: ['left', 'center', 'right'],
			});
			expect(node.alignments).toEqual(['left', 'center', 'right']);
		});
	});
});

describe('Helper node types', () => {
	describe('ListItemNode', () => {
		it('should create with correct _tag', () => {
			const node = ListItemNode({ children: [] });
			expect(node._tag).toBe('ListItem');
		});

		it('should support checked property', () => {
			const checkedNode = ListItemNode({ checked: true, children: [] });
			expect(checkedNode.checked).toBe(true);

			const uncheckedNode = ListItemNode({ checked: false, children: [] });
			expect(uncheckedNode.checked).toBe(false);
		});

		it('should support undefined checked for regular items', () => {
			const node = ListItemNode({ children: [] });
			expect(node.checked).toBeUndefined();
		});
	});

	describe('TableRowNode', () => {
		it('should create with correct _tag', () => {
			const node = TableRowNode({ cells: [] });
			expect(node._tag).toBe('TableRow');
		});

		it('should handle row with multiple cells', () => {
			const cells = Array.from({ length: 5 }, () =>
				TableCellNode({ children: [] })
			);
			const node = TableRowNode({ cells });
			expect(node.cells).toHaveLength(5);
		});
	});

	describe('TableCellNode', () => {
		it('should create with correct _tag', () => {
			const node = TableCellNode({ children: [] });
			expect(node._tag).toBe('TableCell');
		});
	});

	describe('DocumentNode', () => {
		it('should create with correct _tag', () => {
			const node = DocumentNode({ children: [] });
			expect(node._tag).toBe('Document');
		});

		it('should handle large document with many blocks', () => {
			const blocks = Array.from({ length: 100 }, () =>
				ParagraphNode({ children: [] })
			);
			const doc = DocumentNode({ children: blocks });
			expect(doc.children).toHaveLength(100);
		});
	});
});
