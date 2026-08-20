/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	BREAK,
	SKIP,
	Kind,
	isExecutableDefinitionNode,
	isSelectionNode,
	isTypeNode,
	isTypeSystemDefinitionNode,
	isTypeSystemExtensionNode,
	isValueNode,
	parse,
	print,
	visit,
	visitorKeys,
} from '../index.js';
import type { FieldNode, NameNode } from '../index.js';

describe('walking a document', () => {
	it('visits every node, entering before leaving', () => {
		const seen: string[] = [];
		visit(parse('{ user(id: "1") { name } }'), {
			enter: (node) => {
				seen.push(`enter ${node.kind}`);
			},
			leave: (node) => {
				seen.push(`leave ${node.kind}`);
			},
		});

		expect(seen[0]).toBe('enter Document');
		expect(seen.at(-1)).toBe('leave Document');
		expect(seen).toContain('enter Field');
		expect(seen).toContain('enter StringValue');
		expect(seen.filter((entry) => entry === 'enter Name')).toHaveLength(3);
	});

	it('calls the handler for one kind', () => {
		const names: string[] = [];
		visit(parse('{ a b { c } }'), {
			Field: (node) => {
				names.push(node.name.value);
			},
		});

		expect(names).toEqual(['a', 'b', 'c']);
	});

	it('takes enter and leave for one kind', () => {
		const order: string[] = [];
		visit(parse('{ a { b } }'), {
			Field: {
				enter: (node) => {
					order.push(`in ${node.name.value}`);
				},
				leave: (node) => {
					order.push(`out ${node.name.value}`);
				},
			},
		});

		expect(order).toEqual(['in a', 'in b', 'out b', 'out a']);
	});

	it('skips a subtree when asked', () => {
		const names: string[] = [];
		visit(parse('{ a { b c } d }'), {
			Field: (node) => {
				names.push(node.name.value);
				return node.name.value === 'a' ? SKIP : undefined;
			},
		});

		expect(names).toEqual(['a', 'd']);
	});

	it('stops the walk when asked', () => {
		const names: string[] = [];
		visit(parse('{ a b c }'), {
			Field: (node) => {
				names.push(node.name.value);
				return node.name.value === 'b' ? BREAK : undefined;
			},
		});

		expect(names).toEqual(['a', 'b']);
	});

	it('reports where it is', () => {
		const paths: string[] = [];
		visit(parse('{ a { b } }'), {
			Field: (_node, _key, _parent, path) => {
				paths.push(path.join('.'));
			},
		});

		expect(paths[0]).toContain('definitions.0');
		expect(paths[1]).toContain('selectionSet.selections.0');
	});
});

describe('editing while walking', () => {
	it('replaces a node with what the visitor returns', () => {
		const renamed = visit(parse('{ user { name } }'), {
			Name: (node): NameNode =>
				node.value === 'name' ? { ...node, value: 'nickname' } : node,
		});

		expect(print(renamed)).toBe('{\n  user {\n    nickname\n  }\n}');
	});

	it('removes a node when the visitor returns null', () => {
		const trimmed = visit(parse('{ a b c }'), {
			Field: (node): FieldNode | null =>
				node.name.value === 'b' ? null : node,
		});

		expect(print(trimmed)).toBe('{\n  a\n  c\n}');
	});

	it('leaves the original document untouched', () => {
		const original = parse('{ a }');
		const edited = visit(original, {
			Name: (node): NameNode => ({ ...node, value: 'z' }),
		});

		expect(print(original)).toBe('{\n  a\n}');
		expect(print(edited)).toBe('{\n  z\n}');
	});

	it('descends into a replacement', () => {
		const seen: string[] = [];
		visit(parse('{ a }'), {
			Field: (node) => ({
				...node,
				selectionSet:
					parse('{ inner }').definitions[0]?.kind === Kind.OPERATION_DEFINITION
						? undefined
						: undefined,
			}),
			Name: (node) => {
				seen.push(node.value);
				return node;
			},
		});

		expect(seen).toEqual(['a']);
	});
});

describe('walking the catalog side of the language', () => {
	it('visits type system definitions and extensions', () => {
		const kinds: string[] = [];
		visit(
			parse(`
				type User implements Node { id: ID! posts(first: Int = 1): [Post!]! @connection }
				enum Status { DRAFT }
				extend type User { nickname: String? }
			`),
			{
				enter: (node) => {
					kinds.push(node.kind);
				},
			}
		);

		expect(kinds).toContain(Kind.OBJECT_TYPE_DEFINITION);
		expect(kinds).toContain(Kind.FIELD_DEFINITION);
		expect(kinds).toContain(Kind.INPUT_VALUE_DEFINITION);
		expect(kinds).toContain(Kind.ENUM_VALUE_DEFINITION);
		expect(kinds).toContain(Kind.OBJECT_TYPE_EXTENSION);
		expect(kinds).toContain(Kind.NON_NULL_TYPE);
	});

	it('visits pipelines and the expressions inside them', () => {
		const kinds: string[] = [];
		visit(
			parse(
				'{ posts | filter a.b == PUBLISHED | sort c desc | page first: 2 { id } }'
			),
			{
				enter: (node) => {
					kinds.push(node.kind);
				},
			}
		);

		expect(kinds).toContain(Kind.FILTER_STAGE);
		expect(kinds).toContain(Kind.BINARY_EXPRESSION);
		expect(kinds).toContain(Kind.FIELD_PATH);
		expect(kinds).toContain(Kind.SORT_STAGE);
		expect(kinds).toContain(Kind.PAGE_STAGE);
	});

	it('knows the children of every node kind the language defines', () => {
		const missing = Object.values(Kind).filter(
			(kind) => visitorKeys[kind] === undefined
		);

		expect(missing).toEqual([]);
	});
});

describe('telling nodes apart', () => {
	it('sorts definitions into what they are', () => {
		const [operation, type, extension] = parse(
			'{ a } type T { b: Int } extend type T { c: Int }'
		).definitions;

		expect(isExecutableDefinitionNode(operation!)).toBe(true);
		expect(isTypeSystemDefinitionNode(type!)).toBe(true);
		expect(isTypeSystemExtensionNode(extension!)).toBe(true);
		expect(isTypeSystemDefinitionNode(operation!)).toBe(false);
	});

	it('recognises selections, values, and types', () => {
		const document = parse(
			'query A($v: [Int!]) { a(x: 1) { ...F } } fragment F on T { b }'
		);
		const found = { selection: false, value: false, type: false };

		visit(document, {
			enter: (node) => {
				if (isSelectionNode(node)) found.selection = true;
				if (isValueNode(node)) found.value = true;
				if (isTypeNode(node)) found.type = true;
			},
		});

		expect(found).toEqual({ selection: true, value: true, type: true });
	});
});
