/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	Kind,
	NexCatalogError,
	buildCatalog,
	buildCatalogSafe,
} from '../index.js';

const CATALOG = `
	schema { query: Query mutation: Mutation live: Live }

	type Query {
		user(id: ID!): User
		posts(status: Status): [Post!]! @connection
	}
	type Mutation { createPost(input: CreatePostInput!): Post! }
	type Live { feed: [Post!]! @connection }

	interface Node { id: ID! }

	type User implements Node {
		id: ID!
		name: String!
		email: String?
		posts: [Post!]! @connection
		createdAt: DateTime!
	}

	type Post implements Node {
		id: ID!
		title: String!
		status: Status = DRAFT
		author: User!
	}

	type Photo { url: String! }
	type Video { url: String! }
	union Media = Photo | Video

	enum Status { DRAFT PUBLISHED ARCHIVED }
	input CreatePostInput { title: String! tags: [String!] }
	scalar DateTime
	directive @auth(requires: String!) on FIELD
`;

describe('building a catalog', () => {
	const catalog = buildCatalog(CATALOG);

	it('indexes every named type', () => {
		expect(catalog.getType('User')).toMatchObject({
			kind: Kind.OBJECT_TYPE_DEFINITION,
			name: { value: 'User' },
		});
		expect(catalog.getType('Status')?.kind).toBe(Kind.ENUM_TYPE_DEFINITION);
		expect(catalog.getType('Media')?.kind).toBe(Kind.UNION_TYPE_DEFINITION);
		expect(catalog.getType('CreatePostInput')?.kind).toBe(
			Kind.INPUT_OBJECT_TYPE_DEFINITION
		);
		expect(catalog.getType('DateTime')?.kind).toBe(Kind.SCALAR_TYPE_DEFINITION);
		expect(catalog.getType('Nope')).toBeUndefined();
	});

	it('resolves the root operation types named by the schema block', () => {
		expect(catalog.getRootType('query')?.name.value).toBe('Query');
		expect(catalog.getRootType('mutation')?.name.value).toBe('Mutation');
		expect(catalog.getRootType('live')?.name.value).toBe('Live');
	});

	it('falls back to the conventional root type names without a schema block', () => {
		const conventional = buildCatalog(
			'type Query { a: String } type Mutation { b: String }'
		);

		expect(conventional.getRootType('query')?.name.value).toBe('Query');
		expect(conventional.getRootType('mutation')?.name.value).toBe('Mutation');
		expect(conventional.getRootType('live')).toBeUndefined();
	});

	it('looks up fields on objects and interfaces', () => {
		expect(catalog.getField('User', 'email')?.type).toMatchObject({
			kind: Kind.OPTIONAL_TYPE,
		});
		expect(catalog.getField('Node', 'id')?.name.value).toBe('id');
		expect(catalog.getField('User', 'missing')).toBeUndefined();
		expect(catalog.getField('Status', 'id')).toBeUndefined();
	});

	it('reports which fields are connections', () => {
		expect(catalog.isConnectionField('User', 'posts')).toBe(true);
		expect(catalog.isConnectionField('User', 'name')).toBe(false);
		expect(catalog.isConnectionField('User', 'missing')).toBe(false);
	});

	it('resolves the possible object types behind a type name', () => {
		expect(
			catalog.getPossibleTypes('Media').map((type) => type.name.value)
		).toEqual(['Photo', 'Video']);
		expect(
			catalog.getPossibleTypes('Node').map((type) => type.name.value)
		).toEqual(['User', 'Post']);
		expect(
			catalog.getPossibleTypes('User').map((type) => type.name.value)
		).toEqual(['User']);
		expect(catalog.getPossibleTypes('Status')).toEqual([]);
	});

	it('indexes directive definitions', () => {
		expect(catalog.getDirective('auth')?.locations.map((l) => l.value)).toEqual(
			['FIELD']
		);
		expect(catalog.getDirective('nope')).toBeUndefined();
	});

	it('accepts the built-in scalars without a declaration', () => {
		expect(() =>
			buildCatalog('type Query { n: Int f: Float s: String b: Boolean i: ID }')
		).not.toThrow();
	});

	it('ignores executable definitions in a mixed document', () => {
		const mixed = buildCatalog(
			'query A { user } type Query { user: String } fragment F on Query { user }'
		);

		expect([...mixed.types.keys()]).toEqual(['Query']);
	});
});

describe('catalog coherence', () => {
	const messageFor = (source: string): string => {
		try {
			buildCatalog(source);
			return '';
		} catch (error) {
			return error instanceof NexCatalogError ? error.message : String(error);
		}
	};

	it.each([
		[
			'duplicate type',
			'type A { x: String } type A { y: String }',
			/already defined/i,
		],
		[
			'duplicate field',
			'type A { x: String x: Int }',
			/defined more than once/i,
		],
		[
			'duplicate directive',
			'directive @a on FIELD directive @a on FIELD',
			/already defined/i,
		],
		[
			'unknown field type',
			'type A { x: Missing }',
			/refers to unknown type "Missing"/i,
		],
		[
			'unknown argument type',
			'type A { x(a: Missing): String }',
			/refers to unknown type "Missing"/i,
		],
		[
			'unknown interface',
			'type A implements Missing { x: String }',
			/implements unknown type "Missing"/i,
		],
		[
			'interface that is not an interface',
			'type B { x: String } type A implements B { x: String }',
			/is not an interface/i,
		],
		[
			'union member that is not an object',
			'enum E { X } union U = E',
			/is not an object type/i,
		],
		[
			'unknown root type',
			'schema { query: Missing }',
			/root type "Missing" is not defined/i,
		],
		[
			'root type that is not an object',
			'enum E { X } schema { query: E }',
			/must be an object type/i,
		],
	])('rejects a %s', (_label, source, pattern) => {
		expect(messageFor(source)).toMatch(pattern);
	});

	it('points at the offending node', () => {
		try {
			buildCatalog('type A { x: Missing }');
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(NexCatalogError);
			expect((error as NexCatalogError).location?.line).toBe(1);
		}
	});

	it('reports every problem at once when asked to', () => {
		const result = buildCatalogSafe('type A { x: Missing y: AlsoMissing }');

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.length).toBeGreaterThanOrEqual(2);
			expect(
				result.errors.every((error) => error instanceof NexCatalogError)
			).toBe(true);
		}
	});

	it('surfaces a syntax error before any coherence check', () => {
		const result = buildCatalogSafe('type A {');

		expect(result.success).toBe(false);
		if (!result.success)
			expect(result.errors[0]?.message).toMatch(/EOF|Expected/);
	});
});
