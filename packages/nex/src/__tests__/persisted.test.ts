/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { normalizeRequest, parse, requestKey } from '../index.js';

const spaced = `
	query Feed($limit: Int = 10) {

		# the newest posts
		posts | sort createdAt desc | page first: $limit { title ...Card }
	}

	fragment Card on Post { author { name } }
`;

const tight =
	'query Feed($limit:Int=10){posts|sort createdAt desc|page first:$limit{title ...Card}} fragment Card on Post{author{name}}';

describe('normalizing a request', () => {
	it('writes one canonical form, whatever the spacing was', () => {
		expect(normalizeRequest(spaced)).toBe(normalizeRequest(tight));
	});

	it('drops comments and keeps what runs', () => {
		const normalized = normalizeRequest(spaced);

		expect(normalized).not.toContain('newest posts');
		expect(normalized).toContain('| sort createdAt desc');
		expect(normalized).toContain('fragment Card on Post');
	});

	it('takes a document that was already parsed', () => {
		expect(normalizeRequest(parse(tight))).toBe(normalizeRequest(tight));
	});

	it('keeps only the operation asked for, with the fragments it reaches', () => {
		const document = `
			query A { a ...Used }
			query B { b ...Unused }
			fragment Used on Query { u }
			fragment Unused on Query { x }
		`;
		const normalized = normalizeRequest(document, { operationName: 'A' });

		expect(normalized).toContain('query A');
		expect(normalized).toContain('fragment Used');
		expect(normalized).not.toContain('query B');
		expect(normalized).not.toContain('fragment Unused');
	});

	it('refuses an operation the document does not hold', () => {
		expect(() =>
			normalizeRequest('{ a }', { operationName: 'Nope' })
		).toThrowError(/no operation named "Nope"/);
	});

	it('refuses a document with nothing to run', () => {
		expect(() => normalizeRequest('fragment F on Query { a }')).toThrowError(
			/no operation/i
		);
	});
});

describe('keying a request', () => {
	it('gives the same key to the same request written differently', async () => {
		expect(await requestKey(spaced)).toBe(await requestKey(tight));
	});

	it('gives different keys to different requests', async () => {
		expect(await requestKey('{ a }')).not.toBe(await requestKey('{ b }'));
	});

	it('is a hex digest a store can use as a name', async () => {
		expect(await requestKey('{ a }')).toMatch(/^[0-9a-f]{64}$/);
	});

	it('keys one operation out of a document', async () => {
		const document = 'query A { a } query B { b }';

		expect(await requestKey(document, { operationName: 'A' })).toBe(
			await requestKey('query A { a }')
		);
	});

	it('reads the same for a document and its source', async () => {
		expect(await requestKey(parse('{ a }'))).toBe(await requestKey('{ a }'));
	});
});
