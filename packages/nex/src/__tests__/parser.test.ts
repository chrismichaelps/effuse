/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { Effect, Either } from 'effect';
import { describe, expect, it } from 'vitest';
import { NexSyntaxError } from '../errors/index.js';
import { Kind } from '../language/kinds/index.js';
import type {
	DocumentNode,
	OperationDefinitionNode,
} from '../language/ast/index.js';
import { NexLanguageLayer } from '../layers/index.js';
import { ParserService } from '../services/index.js';

const parse = (source: string): DocumentNode =>
	Effect.runSync(
		Effect.gen(function* () {
			const parser = yield* ParserService;
			return yield* parser.parse(source);
		}).pipe(Effect.provide(NexLanguageLayer))
	);

const attempt = (source: string) =>
	Effect.runSync(
		Effect.gen(function* () {
			const parser = yield* ParserService;
			return yield* parser.parse(source);
		}).pipe(Effect.provide(NexLanguageLayer), Effect.either)
	);

const firstOperation = (source: string): OperationDefinitionNode => {
	const definition = parse(source).definitions[0];
	if (definition?.kind !== Kind.OPERATION_DEFINITION) {
		throw new Error(
			`Expected an operation, received ${String(definition?.kind)}`
		);
	}
	return definition;
};

describe('operations', () => {
	it('parses the anonymous query shorthand', () => {
		const operation = firstOperation('{ user { id } }');

		expect(operation.operation).toBe('query');
		expect(operation.name).toBeUndefined();
		expect(operation.selectionSet.selections).toHaveLength(1);
	});

	it('parses named queries, mutations, and live operations', () => {
		const document = parse('query A { a } mutation B { b } live C { c }');

		expect(
			document.definitions.map((definition) =>
				definition.kind === Kind.OPERATION_DEFINITION
					? [definition.operation, definition.name?.value]
					: definition.kind
			)
		).toEqual([
			['query', 'A'],
			['mutation', 'B'],
			['live', 'C'],
		]);
	});

	it('parses variable definitions with defaults', () => {
		const operation = firstOperation(
			'query GetPosts($status: Status = PUBLISHED, $limit: Int = 10) { posts }'
		);

		expect(operation.variableDefinitions).toHaveLength(2);
		const [status] = operation.variableDefinitions ?? [];
		expect(status?.variable.name.value).toBe('status');
		expect(status?.type).toMatchObject({
			kind: Kind.NAMED_TYPE,
			name: { value: 'Status' },
		});
		expect(status?.defaultValue).toMatchObject({
			kind: Kind.ENUM,
			value: 'PUBLISHED',
		});
	});

	it('records the source location of each node', () => {
		const operation = firstOperation('{\n  user\n}');
		const [field] = operation.selectionSet.selections;

		expect(field?.loc).toMatchObject({ start: 4, end: 8, line: 2, column: 3 });
	});
});

describe('selection sets', () => {
	it('parses aliases, arguments, and nesting', () => {
		const operation = firstOperation(
			'{ owner: user(id: $id, active: true) { posts { title } } }'
		);
		const [field] = operation.selectionSet.selections;

		expect(field).toMatchObject({
			kind: Kind.FIELD,
			alias: { value: 'owner' },
			name: { value: 'user' },
		});
		if (field?.kind !== Kind.FIELD) throw new Error('expected a field');
		expect(field.arguments).toMatchObject([
			{
				name: { value: 'id' },
				value: { kind: Kind.VARIABLE, name: { value: 'id' } },
			},
			{ name: { value: 'active' }, value: { kind: Kind.BOOLEAN, value: true } },
		]);
		expect(field.selectionSet?.selections).toHaveLength(1);
	});

	it('parses the __typename meta field', () => {
		const operation = firstOperation('{ __typename }');

		expect(operation.selectionSet.selections[0]).toMatchObject({
			kind: Kind.FIELD,
			name: { value: '__typename' },
		});
	});

	it('parses directives on fields and operations', () => {
		const operation = firstOperation(
			'query A @cost(value: 10) { user @include(if: $show) { id } }'
		);

		expect(operation.directives).toMatchObject([
			{
				kind: Kind.DIRECTIVE,
				name: { value: 'cost' },
				arguments: [{ name: { value: 'value' } }],
			},
		]);
		expect(operation.selectionSet.selections[0]).toMatchObject({
			directives: [{ name: { value: 'include' } }],
		});
	});
});

describe('fragments', () => {
	it('parses fragment definitions', () => {
		const [definition] = parse(
			'fragment UserCard on User { id name }'
		).definitions;

		expect(definition).toMatchObject({
			kind: Kind.FRAGMENT_DEFINITION,
			name: { value: 'UserCard' },
			typeCondition: { kind: Kind.NAMED_TYPE, name: { value: 'User' } },
		});
	});

	it('parses fragment spreads', () => {
		const operation = firstOperation('{ user { ...UserCard bio } }');
		const [field] = operation.selectionSet.selections;
		if (field?.kind !== Kind.FIELD) throw new Error('expected a field');

		expect(field.selectionSet?.selections[0]).toMatchObject({
			kind: Kind.FRAGMENT_SPREAD,
			name: { value: 'UserCard' },
		});
	});

	it('parses inline fragments with and without a type condition', () => {
		const operation = firstOperation(
			'{ node { ... on User { name } ... @defer { id } } }'
		);
		const [field] = operation.selectionSet.selections;
		if (field?.kind !== Kind.FIELD) throw new Error('expected a field');

		expect(field.selectionSet?.selections[0]).toMatchObject({
			kind: Kind.INLINE_FRAGMENT,
			typeCondition: { name: { value: 'User' } },
		});
		const untyped = field.selectionSet?.selections[1];
		expect(untyped).toMatchObject({
			kind: Kind.INLINE_FRAGMENT,
			directives: [{ name: { value: 'defer' } }],
		});
		expect(untyped && 'typeCondition' in untyped).toBe(false);
	});
});

describe('values', () => {
	const argumentValue = (literal: string) => {
		const operation = firstOperation(`{ field(arg: ${literal}) }`);
		const [field] = operation.selectionSet.selections;
		if (field?.kind !== Kind.FIELD) throw new Error('expected a field');
		return field.arguments?.[0]?.value;
	};

	it('parses scalar literals', () => {
		expect(argumentValue('10')).toMatchObject({ kind: Kind.INT, value: '10' });
		expect(argumentValue('1.5')).toMatchObject({
			kind: Kind.FLOAT,
			value: '1.5',
		});
		expect(argumentValue('"text"')).toMatchObject({
			kind: Kind.STRING,
			value: 'text',
		});
		expect(argumentValue('true')).toMatchObject({
			kind: Kind.BOOLEAN,
			value: true,
		});
		expect(argumentValue('null')).toMatchObject({ kind: Kind.NULL });
		expect(argumentValue('DRAFT')).toMatchObject({
			kind: Kind.ENUM,
			value: 'DRAFT',
		});
	});

	it('marks block strings so printers can round-trip them', () => {
		expect(argumentValue('"""\n  body\n  """')).toMatchObject({
			kind: Kind.STRING,
			value: 'body',
			block: true,
		});
	});

	it('parses list and object literals', () => {
		expect(argumentValue('[1, 2]')).toMatchObject({
			kind: Kind.LIST,
			values: [{ value: '1' }, { value: '2' }],
		});
		expect(argumentValue('{ title: "a", tags: [] }')).toMatchObject({
			kind: Kind.OBJECT,
			fields: [
				{
					kind: Kind.OBJECT_FIELD,
					name: { value: 'title' },
					value: { value: 'a' },
				},
				{ name: { value: 'tags' }, value: { kind: Kind.LIST, values: [] } },
			],
		});
	});
});

describe('type references', () => {
	const variableType = (type: string) =>
		firstOperation(`query A($v: ${type}) { a }`).variableDefinitions?.[0]?.type;

	it('parses named, non-null, and optional types', () => {
		expect(variableType('ID')).toMatchObject({ kind: Kind.NAMED_TYPE });
		expect(variableType('ID!')).toMatchObject({
			kind: Kind.NON_NULL_TYPE,
			type: { kind: Kind.NAMED_TYPE, name: { value: 'ID' } },
		});
		expect(variableType('ID?')).toMatchObject({
			kind: Kind.OPTIONAL_TYPE,
			type: { kind: Kind.NAMED_TYPE, name: { value: 'ID' } },
		});
	});

	it('parses both list spellings identically', () => {
		const expected = {
			kind: Kind.NON_NULL_TYPE,
			type: {
				kind: Kind.LIST_TYPE,
				type: {
					kind: Kind.NON_NULL_TYPE,
					type: { kind: Kind.NAMED_TYPE, name: { value: 'Post' } },
				},
			},
		};

		expect(variableType('[Post!]!')).toMatchObject(expected);
		expect(variableType('Post![]!')).toMatchObject(expected);
	});
});

describe('pipelines', () => {
	const stages = (source: string) => {
		const operation = firstOperation(source);
		const [field] = operation.selectionSet.selections;
		if (field?.kind !== Kind.FIELD) throw new Error('expected a field');
		return field.pipeline;
	};

	it('parses a filter stage into a comparison expression', () => {
		expect(
			stages('{ posts | filter status == PUBLISHED { title } }')
		).toMatchObject([
			{
				kind: Kind.FILTER_STAGE,
				condition: {
					kind: Kind.BINARY_EXPRESSION,
					operator: '==',
					left: { kind: Kind.FIELD_PATH, segments: [{ value: 'status' }] },
					right: { kind: Kind.ENUM, value: 'PUBLISHED' },
				},
			},
		]);
	});

	it('parses boolean operators with and binding tighter than or', () => {
		const [stage] =
			stages('{ posts | filter a == 1 and b == 2 or c == 3 { t } }') ?? [];

		expect(stage).toMatchObject({
			condition: {
				operator: 'or',
				left: { operator: 'and' },
				right: { operator: '==', left: { segments: [{ value: 'c' }] } },
			},
		});
	});

	it('parses parenthesised conditions, negation, and nested paths', () => {
		const [stage] =
			stages('{ posts | filter not (author.name != "x") { t } }') ?? [];

		expect(stage).toMatchObject({
			condition: {
				kind: Kind.UNARY_EXPRESSION,
				operator: 'not',
				expression: {
					operator: '!=',
					left: { segments: [{ value: 'author' }, { value: 'name' }] },
				},
			},
		});
	});

	it('parses sort with an explicit and a default direction', () => {
		expect(
			stages('{ posts | sort createdAt desc | sort id { t } }')
		).toMatchObject([
			{
				kind: Kind.SORT_STAGE,
				field: { segments: [{ value: 'createdAt' }] },
				direction: 'desc',
			},
			{ kind: Kind.SORT_STAGE, direction: 'asc' },
		]);
	});

	it('parses take, skip, and unique', () => {
		expect(
			stages('{ posts | skip 5 | take $limit | unique { t } }')
		).toMatchObject([
			{ kind: Kind.SKIP_STAGE, count: { kind: Kind.INT, value: '5' } },
			{
				kind: Kind.TAKE_STAGE,
				count: { kind: Kind.VARIABLE, name: { value: 'limit' } },
			},
			{ kind: Kind.UNIQUE_STAGE },
		]);
	});

	it('parses page arguments without requiring parentheses', () => {
		expect(
			stages('{ posts | page first: 10 after: $cursor { t } }')
		).toMatchObject([
			{
				kind: Kind.PAGE_STAGE,
				arguments: [
					{ name: { value: 'first' }, value: { kind: Kind.INT, value: '10' } },
					{
						name: { value: 'after' },
						value: { kind: Kind.VARIABLE, name: { value: 'cursor' } },
					},
				],
			},
		]);
	});

	it('parses an unknown stage as a custom operator so extensions keep working', () => {
		expect(stages('{ posts | search term: "nex" { t } }')).toMatchObject([
			{
				kind: Kind.CUSTOM_STAGE,
				name: { value: 'search' },
				arguments: [{ name: { value: 'term' }, value: { value: 'nex' } }],
			},
		]);
	});

	it('parses a chained pipeline in the order it was written', () => {
		const chain = stages(
			'{ posts | filter status == PUBLISHED | sort createdAt desc | page first: 10 after: $cursor { title } }'
		);

		expect(chain?.map((stage) => stage.kind)).toEqual([
			Kind.FILTER_STAGE,
			Kind.SORT_STAGE,
			Kind.PAGE_STAGE,
		]);
	});
});

describe('parser failures', () => {
	it('reports an unexpected token with its location', () => {
		const result = attempt('{ user { id }');

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toBeInstanceOf(NexSyntaxError);
			expect(result.left.message).toContain('Expected');
		}
	});

	it('rejects an empty selection set', () => {
		const result = attempt('{ user { } }');

		expect(Either.isLeft(result)).toBe(true);
	});

	it('rejects an unknown operation keyword', () => {
		const result = attempt('subscribe A { a }');

		expect(Either.isLeft(result)).toBe(true);
	});

	it('rejects a trailing pipe with no stage', () => {
		const result = attempt('{ posts | }');

		expect(Either.isLeft(result)).toBe(true);
	});
});
