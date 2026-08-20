/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	Kind,
	buildCatalog,
	parseCoordinate,
	printCoordinate,
	resolveCoordinate,
} from '../index.js';

const catalog = buildCatalog(`
	type Query { posts(status: Status, first: Int): [Post!]! @connection }
	type Post { id: ID! title: String! }
	enum Status { DRAFT PUBLISHED }
	input NewPost { title: String! }
	directive @tag(name: String!) on FIELD
`);

describe('reading a coordinate', () => {
	it('reads each shape a coordinate can take', () => {
		expect(parseCoordinate('Post')).toMatchObject({
			kind: Kind.TYPE_COORDINATE,
			name: { value: 'Post' },
		});
		expect(parseCoordinate('Post.title')).toMatchObject({
			kind: Kind.MEMBER_COORDINATE,
			name: { value: 'Post' },
			member: { value: 'title' },
		});
		expect(parseCoordinate('Query.posts(status:)')).toMatchObject({
			kind: Kind.ARGUMENT_COORDINATE,
			name: { value: 'Query' },
			member: { value: 'posts' },
			argument: { value: 'status' },
		});
		expect(parseCoordinate('@tag')).toMatchObject({
			kind: Kind.DIRECTIVE_COORDINATE,
			name: { value: 'tag' },
		});
		expect(parseCoordinate('@tag(name:)')).toMatchObject({
			kind: Kind.DIRECTIVE_ARGUMENT_COORDINATE,
			name: { value: 'tag' },
			argument: { value: 'name' },
		});
	});

	it('ignores the whitespace around it', () => {
		expect(
			printCoordinate(parseCoordinate('  Query . posts ( status : )  '))
		).toBe('Query.posts(status:)');
	});

	it.each([
		['nothing', ''],
		['a trailing dot', 'Post.'],
		['a member of a directive', '@tag.name'],
		['an argument with no colon', 'Query.posts(status)'],
		['an unclosed argument', 'Query.posts(status:'],
		['something after the end', 'Post.title extra'],
	])('refuses %s', (_label, source) => {
		expect(() => parseCoordinate(source)).toThrowError(/coordinate/i);
	});

	it('prints what it read', () => {
		for (const source of [
			'Post',
			'Post.title',
			'Query.posts(first:)',
			'@tag',
			'@tag(name:)',
		]) {
			expect(printCoordinate(parseCoordinate(source))).toBe(source);
		}
	});
});

describe('following a coordinate into a catalog', () => {
	it('finds a type', () => {
		expect(resolveCoordinate(catalog, 'Post')).toMatchObject({
			kind: Kind.OBJECT_TYPE_DEFINITION,
			name: { value: 'Post' },
		});
	});

	it('finds a field, an enum value, and an input field', () => {
		expect(resolveCoordinate(catalog, 'Post.title')).toMatchObject({
			kind: Kind.FIELD_DEFINITION,
		});
		expect(resolveCoordinate(catalog, 'Status.DRAFT')).toMatchObject({
			kind: Kind.ENUM_VALUE_DEFINITION,
		});
		expect(resolveCoordinate(catalog, 'NewPost.title')).toMatchObject({
			kind: Kind.INPUT_VALUE_DEFINITION,
		});
	});

	it('finds an argument, on a field and on a directive', () => {
		expect(resolveCoordinate(catalog, 'Query.posts(first:)')).toMatchObject({
			kind: Kind.INPUT_VALUE_DEFINITION,
			name: { value: 'first' },
		});
		expect(resolveCoordinate(catalog, '@tag(name:)')).toMatchObject({
			kind: Kind.INPUT_VALUE_DEFINITION,
			name: { value: 'name' },
		});
	});

	it('finds a directive', () => {
		expect(resolveCoordinate(catalog, '@tag')).toMatchObject({
			kind: Kind.DIRECTIVE_DEFINITION,
		});
	});

	it('has nothing to say about what the catalog does not hold', () => {
		expect(resolveCoordinate(catalog, 'Missing')).toBeUndefined();
		expect(resolveCoordinate(catalog, 'Post.missing')).toBeUndefined();
		expect(resolveCoordinate(catalog, 'Query.posts(missing:)')).toBeUndefined();
		expect(resolveCoordinate(catalog, '@missing')).toBeUndefined();
		expect(resolveCoordinate(catalog, 'Status.MISSING')).toBeUndefined();
	});

	it('takes a coordinate that was already read', () => {
		expect(
			resolveCoordinate(catalog, parseCoordinate('Post.id'))
		).toMatchObject({
			kind: Kind.FIELD_DEFINITION,
			name: { value: 'id' },
		});
	});
});
