/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	Kind,
	NexCatalogError,
	NexSyntaxError,
	TokenKind,
	buildCatalog,
	buildCatalogSafe,
	isDocument,
	parse,
	parseSafe,
	print,
	tokenize,
	validateDocument,
} from '../index.js';

describe('public API', () => {
	it('parses to a plain document object', () => {
		const document = parse('{ user { id } }');

		expect(document.kind).toBe(Kind.DOCUMENT);
		expect(Object.getPrototypeOf(document)).toBe(Object.prototype);
	});

	it('throws a NexSyntaxError with a location on bad input', () => {
		expect(() => parse('{ user { id }')).toThrowError(NexSyntaxError);

		try {
			parse('{ user { id }');
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(NexSyntaxError);
			expect((error as NexSyntaxError).location.line).toBe(1);
		}
	});

	it('offers a non-throwing parse that returns a plain result', () => {
		const ok = parseSafe('{ user }');
		const bad = parseSafe('{ user');

		expect(ok).toMatchObject({ success: true });
		expect(bad).toMatchObject({ success: false });
		if (!bad.success) expect(bad.error).toBeInstanceOf(NexSyntaxError);
		if (ok.success) expect(ok.document.definitions).toHaveLength(1);
	});

	it('tokenizes to a plain readonly array', () => {
		const tokens = tokenize('{ user }');

		expect(Array.isArray(tokens)).toBe(true);
		expect(tokens.at(-1)?.kind).toBe(TokenKind.EOF);
	});

	it('prints a document back to source', () => {
		expect(print(parse('{user{id}}'))).toBe('{\n  user {\n    id\n  }\n}');
	});

	it('validates untrusted documents without leaking Effect types', () => {
		const document = parse('{ user }');

		expect(validateDocument(document)).toEqual(document);
		expect(isDocument(document)).toBe(true);
		expect(
			isDocument({ kind: 'Document', definitions: [{ kind: 'Nope' }] })
		).toBe(false);
		expect(() => validateDocument({ kind: 'Nope' })).toThrowError(
			NexSyntaxError
		);
	});

	it('does not re-export Effect entry points', async () => {
		const exports = Object.keys(await import('../index.js'));

		expect(exports).not.toContain('Effect');
		expect(exports).not.toContain('Layer');
		expect(exports.filter((name) => name.endsWith('Layer'))).toEqual([]);
		expect(exports.filter((name) => name.endsWith('Service'))).toEqual([]);
		expect(exports.filter((name) => name.endsWith('Schema'))).toEqual([]);
	});

	it('raises a plain Error subclass, not an Effect data type', () => {
		const result = parseSafe('{');
		if (result.success) return expect.unreachable();

		expect(result.error).toBeInstanceOf(Error);
		expect(Object.getPrototypeOf(Object.getPrototypeOf(result.error))).toBe(
			Error.prototype
		);
		expect(result.error.name).toBe('NexSyntaxError');
		expect(result.error._tag).toBe('NexSyntaxError');
		expect(result.error.message).toContain('Expected');
		expect(typeof result.error.stack).toBe('string');
	});

	it('builds a catalog and answers questions about it', () => {
		const catalog = buildCatalog(
			'type Query { posts: [Post!]! @connection } type Post { id: ID! }'
		);

		expect(catalog.getRootType('query')?.name.value).toBe('Query');
		expect(catalog.isConnectionField('Query', 'posts')).toBe(true);
		expect(catalog.types).toBeInstanceOf(Map);
	});

	it('reports catalog problems as plain errors', () => {
		const result = buildCatalogSafe('type Query { post: Missing }');

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors[0]).toBeInstanceOf(NexCatalogError);
			expect(result.errors[0]).toBeInstanceOf(Error);
		}
		expect(() => buildCatalog('type Query { post: Missing }')).toThrowError(
			NexCatalogError
		);
	});

	it('exports every function the package is meant to be used through', async () => {
		const surface = Object.keys(await import('../index.js'));

		expect(surface).toEqual(
			expect.arrayContaining([
				'analyzeRequest',
				'applyPatch',
				'diffValues',
				'readEventStream',
				'buildCatalog',
				'buildCatalogFromIntrospection',
				'buildCatalogFromIntrospectionSafe',
				'buildCatalogSafe',
				'compareCatalogs',
				'createNexClient',
				'createOperationStore',
				'concatDocuments',
				'execute',
				'findBrokenOperations',
				'findDeprecations',
				'generateCatalogTypes',
				'generateTypes',
				'introspectionFromCatalog',
				'minifyRequest',
				'createNexHandler',
				'isDocument',
				'isValidRequest',
				'normalizeRequest',
				'getOperation',
				'parse',
				'parseCoordinate',
				'parseSafe',
				'print',
				'printCatalog',
				'sortCatalog',
				'valueToNode',
				'visitWithTypes',
				'printCoordinate',
				'printSourceExcerpt',
				'requestKey',
				'resolveCoordinate',
				'separateOperations',
				'subscribe',
				'toEventStream',
				'tokenize',
				'validateDocument',
				'validateRequest',
				'visit',
			])
		);
	});

	it('exports every error type it can raise', async () => {
		const surface = Object.keys(await import('../index.js'));

		expect(surface).toEqual(
			expect.arrayContaining([
				'NexCatalogError',
				'NexErrorCode',
				'NexExecutionError',
				'NexSyntaxError',
				'NexValidationError',
			])
		);
	});

	it('exports the constants a caller matches on', async () => {
		const surface = Object.keys(await import('../index.js'));

		expect(surface).toEqual(
			expect.arrayContaining([
				'BUILT_IN_SCALARS',
				'ChangeSeverity',
				'DirectiveLocation',
				'ErrorPolicy',
				'LiveDelivery',
				'OPTIONAL_FEATURES',
				'Kind',
				'OperationType',
				'INTROSPECTION_QUERY',
				'PIPELINE_OPERATORS',
				'TokenKind',
				'visitorKeys',
			])
		);
	});
});
