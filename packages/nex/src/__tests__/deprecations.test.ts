/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, findDeprecations } from '../index.js';

const catalog = buildCatalog(`
	type Query {
		posts(status: Status, legacyFilter: String @deprecated(reason: "use status")): [Post!]! @connection
		feed: [Post!]! @deprecated(reason: "use posts")
		me: User
	}
	type Post { id: ID! title: String! status: Status! byline: String @deprecated }
	type User { id: ID! handle: String @deprecated(reason: "use name") name: String! }
	enum Status { DRAFT PUBLISHED RETIRED @deprecated(reason: "no longer used") }
	input Filter { term: String legacy: Boolean @deprecated(reason: "ignored") }
`);

const notices = (source: string) =>
	findDeprecations(source, catalog).map((notice) => notice.coordinate);

describe('what a request still leans on', () => {
	it('says nothing about a request that uses nothing deprecated', () => {
		expect(findDeprecations('{ posts { title } }', catalog)).toEqual([]);
	});

	it('reports a deprecated field', () => {
		expect(notices('{ feed { title } }')).toEqual(['Query.feed']);
	});

	it('reports a deprecated field reached through a fragment', () => {
		expect(notices('{ me { ...U } } fragment U on User { handle }')).toEqual([
			'User.handle',
		]);
	});

	it('reports a deprecated argument', () => {
		expect(notices('{ posts(legacyFilter: "x") { title } }')).toEqual([
			'Query.posts(legacyFilter:)',
		]);
	});

	it('reports a deprecated enum value written as an argument', () => {
		expect(notices('{ posts(status: RETIRED) { title } }')).toEqual([
			'Status.RETIRED',
		]);
	});

	it('reports a deprecated value inside a pipeline filter', () => {
		expect(notices('{ posts | filter status == RETIRED { title } }')).toEqual([
			'Status.RETIRED',
		]);
	});

	it('carries the reason, the path, and where it was written', () => {
		const [notice] = findDeprecations('{ me { handle } }', catalog);

		expect(notice).toMatchObject({
			coordinate: 'User.handle',
			reason: 'use name',
			path: ['me', 'handle'],
		});
		expect(notice?.location?.line).toBe(1);
		expect(notice?.message).toMatch(/"User.handle" is deprecated: use name/);
	});

	it('says so even when a definition gives no reason', () => {
		const [notice] = findDeprecations('{ posts { byline } }', catalog);

		expect(notice?.reason).toBeUndefined();
		expect(notice?.message).toBe('"Post.byline" is deprecated');
	});

	it('reports each place, not each name', () => {
		expect(notices('{ a: feed { title } b: feed { title } }')).toEqual([
			'Query.feed',
			'Query.feed',
		]);
	});

	it('takes a document that was already parsed, and one operation of it', () => {
		const document = 'query A { feed { title } } query B { me { handle } }';

		expect(
			findDeprecations(document, catalog, { operationName: 'B' })
		).toMatchObject([{ coordinate: 'User.handle' }]);
	});

	it('leaves a request the catalog does not recognise alone', () => {
		expect(findDeprecations('{ nope { title } }', catalog)).toEqual([]);
	});
});
