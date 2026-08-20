/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, generateCatalogTypes } from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query mutation: Mutation }

	"What a client can read."
	type Query {
		posts(status: Status, first: Int = 10): [Post!]! @connection
		me: User
		node: Node
	}
	type Mutation { createPost(input: NewPost!): Post! }

	interface Node { id: ID! }
	type User implements Node { id: ID! name: String! nickname: String? }
	type Post implements Node { id: ID! title: String! status: Status! author: User! tags: [String!] }
	type Photo { url: String! }
	union Media = User | Photo

	enum Status { DRAFT PUBLISHED }
	input NewPost { title: String! draft: Boolean = true size: Int! = 5 }
	scalar DateTime
`);

const types = generateCatalogTypes(catalog);

describe('what the catalog holds, in TypeScript', () => {
	it('writes an enum as the values it can take', () => {
		expect(types).toContain("export type Status = 'DRAFT' | 'PUBLISHED';");
	});

	it('writes an object type, nullability and all', () => {
		expect(types).toContain(
			[
				'export type User = {',
				'\tid: string;',
				'\tname: string;',
				'\tnickname: string | null;',
				'};',
			].join('\n')
		);
	});

	it('writes a list, and a nullable list', () => {
		expect(types).toContain('tags: string[] | null;');
		expect(types).toContain('author: User;');
	});

	it('writes an input type, optional where a value may be left out', () => {
		expect(types).toContain(
			[
				'export type NewPost = {',
				'\ttitle: string;',
				'\tdraft?: boolean | null;',
				'\tsize?: number;',
				'};',
			].join('\n')
		);
	});

	it('writes a union as the types it can be', () => {
		expect(types).toContain('export type Media = User | Photo;');
	});

	it('writes an interface as what every implementer has', () => {
		expect(types).toContain('export type Node = {');
	});

	it('writes a custom scalar as something a caller must narrow', () => {
		expect(types).toContain('export type DateTime = unknown;');
	});

	it('carries a description across as a comment', () => {
		expect(types).toContain(
			'/** What a client can read. */\nexport type Query = {'
		);
	});
});

describe('the resolvers such a catalog needs', () => {
	it('writes a resolver map, every part optional', () => {
		expect(types).toContain(
			'export type CatalogResolvers<TContext = unknown> = {'
		);
		expect(types).toContain('\tQuery?: {');
		expect(types).toContain('\t\tposts?: ');
	});

	it('types what a resolver is given and what it returns', () => {
		expect(types).toMatch(
			/posts\?: \(\s*source: Query,\s*args: \{ status\?: Status \| null; first\?: number \| null \},\s*context: TContext,\s*info: ResolverInfo\s*\) => Post\[\] \| Promise<Post\[\]>;/
		);
	});

	it('takes a context type, defaulting to unknown', () => {
		expect(types).toContain(
			'export type CatalogResolvers<TContext = unknown> = {'
		);
	});

	it('leaves out the types that hold no fields', () => {
		expect(types).not.toContain('\tStatus?: {');
		expect(types).not.toContain('\tNewPost?: {');
		expect(types).not.toContain('\tMedia?: {');
	});

	it('lets an abstract type say which one it is', () => {
		expect(types).toContain('\tNode?: {');
		expect(types).toContain('__resolveType?:');
	});
});

describe('what it does not write', () => {
	it('leaves introspection out of it', () => {
		expect(types).not.toContain('__Schema');
		expect(types).not.toContain('__Type');
	});

	it('writes something a caller can drop into a file', () => {
		expect(types.startsWith('/**')).toBe(true);
		expect(types.endsWith('\n')).toBe(true);
		expect(types).toContain("import type { ResolverInfo } from '@effuse/nex';");
	});
});
