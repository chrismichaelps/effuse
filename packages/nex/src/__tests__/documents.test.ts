/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	concatDocuments,
	getOperation,
	parse,
	print,
	separateOperations,
} from '../index.js';

const document = parse(`
	query A { a ...Shared }
	query B { b ...OnlyB }
	mutation C { c }
	fragment Shared on Query { s }
	fragment OnlyB on Query { o ...Shared }
`);

describe('splitting a document by operation', () => {
	it('gives each operation its own document', () => {
		const separated = separateOperations(document);

		expect(Object.keys(separated)).toEqual(['A', 'B', 'C']);
	});

	it('carries only the fragments an operation reaches', () => {
		const separated = separateOperations(document);

		expect(print(separated.A!)).toBe(
			[
				'query A {',
				'  a',
				'  ...Shared',
				'}',
				'',
				'fragment Shared on Query {',
				'  s',
				'}',
			].join('\n')
		);
		expect(print(separated.B!)).toContain('fragment OnlyB');
		expect(print(separated.B!)).toContain('fragment Shared');
		expect(print(separated.C!)).toBe('mutation C {\n  c\n}');
	});

	it('keys an anonymous operation by the empty string', () => {
		expect(Object.keys(separateOperations(parse('{ a }')))).toEqual(['']);
	});

	it('does not follow a fragment cycle forever', () => {
		const cyclic = parse(
			'query A { ...X } fragment X on Query { ...Y } fragment Y on Query { ...X }'
		);

		expect(print(separateOperations(cyclic).A!)).toContain('fragment Y');
	});
});

describe('joining documents', () => {
	it('puts the definitions of each one after another', () => {
		const joined = concatDocuments(
			parse('{ a }'),
			parse('fragment F on Query { b }')
		);

		expect(joined.definitions).toHaveLength(2);
		expect(print(joined)).toBe('{\n  a\n}\n\nfragment F on Query {\n  b\n}');
	});

	it('joins nothing into an empty document', () => {
		expect(concatDocuments().definitions).toEqual([]);
	});
});

describe('picking the operation to run', () => {
	it('finds one by name', () => {
		expect(getOperation(document, 'B')?.name?.value).toBe('B');
	});

	it('takes the only operation when no name is given', () => {
		expect(getOperation(parse('{ a }'))?.operation).toBe('query');
	});

	it('has nothing to return when the name is not there', () => {
		expect(getOperation(document, 'Nope')).toBeUndefined();
	});
});
