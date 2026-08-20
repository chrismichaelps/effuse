/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	Kind,
	buildCatalog,
	introspectionFromCatalog,
	minifyRequest,
	parse,
	print,
	printCatalog,
	sortCatalog,
	valueToNode,
	visitWithTypes,
} from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query }
	type Query {
		posts(status: Status, filter: Filter): [Post!]! @connection
		me: User
	}
	type Post { id: ID! title: String! author: User! }
	type User { id: ID! name: String! }
	enum Status { DRAFT PUBLISHED }
	input Filter { term: String! since: DateTime }
	scalar DateTime
`);

describe('walking a request knowing the types', () => {
	it('says which type each field belongs to, and what it returns', () => {
		const seen: string[] = [];

		visitWithTypes(
			parse('{ posts | take 1 { title author { name } } }'),
			catalog,
			{
				Field: (node, types) => {
					seen.push(
						`${types.parentTypeName ?? '?'}.${node.name.value}: ${types.typeName ?? '?'}`
					);
				},
			}
		);

		expect(seen).toEqual([
			'Query.posts: Post',
			'Post.title: String',
			'Post.author: User',
			'User.name: String',
		]);
	});

	it('hands over the field a request is asking for', () => {
		const connections: string[] = [];

		visitWithTypes(parse('{ posts | take 1 { title } }'), catalog, {
			Field: (node, types) => {
				if (
					types.fieldDefinition?.directives?.some(
						(d) => d.name.value === 'connection'
					)
				) {
					connections.push(node.name.value);
				}
			},
		});

		expect(connections).toEqual(['posts']);
	});

	it('says what an argument and its value are typed as', () => {
		const seen: string[] = [];

		visitWithTypes(
			parse('{ posts(status: PUBLISHED, filter: { term: "x" }) { id } }'),
			catalog,
			{
				Argument: (node, types) => {
					seen.push(`${node.name.value}: ${types.inputTypeName ?? '?'}`);
				},
				ObjectField: (node, types) => {
					seen.push(`${node.name.value}: ${types.inputTypeName ?? '?'}`);
				},
			}
		);

		expect(seen).toEqual(['status: Status', 'filter: Filter', 'term: String']);
	});

	it('follows fragments, and keeps its place on the way out', () => {
		const order: string[] = [];

		visitWithTypes(
			parse('{ me { ...U } } fragment U on User { name }'),
			catalog,
			{
				Field: (node, types) => {
					order.push(`in ${types.parentTypeName ?? '?'}.${node.name.value}`);
				},
			}
		);

		expect(order).toEqual(['in Query.me', 'in User.name']);
	});

	it('says nothing about a field the catalog does not know', () => {
		const seen: (string | undefined)[] = [];

		visitWithTypes(parse('{ nope { deeper } }'), catalog, {
			Field: (_node, types) => {
				seen.push(types.typeName);
			},
		});

		expect(seen).toEqual([undefined, undefined]);
	});
});

describe('writing a value as a node', () => {
	it('reads each kind of value', () => {
		expect(valueToNode('text')).toMatchObject({
			kind: Kind.STRING,
			value: 'text',
		});
		expect(valueToNode(3)).toMatchObject({ kind: Kind.INT, value: '3' });
		expect(valueToNode(1.5)).toMatchObject({ kind: Kind.FLOAT, value: '1.5' });
		expect(valueToNode(true)).toMatchObject({
			kind: Kind.BOOLEAN,
			value: true,
		});
		expect(valueToNode(null)).toMatchObject({ kind: Kind.NULL });
		expect(valueToNode([1, 2])).toMatchObject({ kind: Kind.LIST });
		expect(valueToNode({ a: 1 })).toMatchObject({ kind: Kind.OBJECT });
	});

	it('writes an enum as an enum when the catalog says so', () => {
		expect(
			valueToNode('PUBLISHED', { catalog, typeName: 'Status' })
		).toMatchObject({
			kind: Kind.ENUM,
			value: 'PUBLISHED',
		});
		expect(valueToNode('PUBLISHED')).toMatchObject({ kind: Kind.STRING });
	});

	it('writes what an input type expects, field by field', () => {
		const node = valueToNode(
			{ term: 'x', since: '2026-01-01' },
			{ catalog, typeName: 'Filter' }
		);

		expect(
			print(parse(`{ posts(filter: ${printValueOf(node)}) { id } }`))
		).toContain('term: "x"');
	});

	it('round-trips through the printer', () => {
		const node = valueToNode({ a: [1, 'two', null], b: true });

		expect(printValueOf(node)).toBe('{ a: [1, "two", null], b: true }');
	});

	it('refuses a value it cannot write', () => {
		expect(() => valueToNode(() => undefined)).toThrowError(
			/cannot be written/i
		);
		expect(() => valueToNode(Number.NaN)).toThrowError(/cannot be written/i);
	});
});

/** Print one value node by putting it somewhere a printer will reach it. */
const printValueOf = (node: ReturnType<typeof valueToNode>): string => {
	const document = parse('{ posts(filter: null) { id } }');
	const operation = document.definitions[0];
	if (operation?.kind !== Kind.OPERATION_DEFINITION)
		throw new Error('unreachable');

	const field = operation.selectionSet.selections[0];
	if (field?.kind !== Kind.FIELD) throw new Error('unreachable');

	const printed = print({
		...document,
		definitions: [
			{
				...operation,
				selectionSet: {
					...operation.selectionSet,
					selections: [
						{
							...field,
							arguments: [
								{
									kind: Kind.ARGUMENT,
									name: { kind: Kind.NAME, value: 'filter' },
									value: node,
								},
							],
						},
					],
				},
			},
		],
	});

	return printed.slice(
		printed.indexOf('filter: ') + 'filter: '.length,
		printed.indexOf(') {')
	);
};

describe('putting a catalog in a settled order', () => {
	const shuffled = buildCatalog(`
		type Query { b: String a: String }
		enum Status { PUBLISHED DRAFT }
		type Zebra { id: ID! }
		type Apple { id: ID! }
	`);
	const ordered = buildCatalog(`
		type Query { a: String b: String }
		enum Status { DRAFT PUBLISHED }
		type Apple { id: ID! }
		type Zebra { id: ID! }
	`);

	it('prints the same for two catalogs that say the same thing', () => {
		expect(printCatalog(sortCatalog(shuffled))).toBe(
			printCatalog(sortCatalog(ordered))
		);
	});

	it('leaves what a catalog means alone', () => {
		const sorted = sortCatalog(shuffled);

		expect(sorted.getField('Query', 'a')).toBeDefined();
		expect(sorted.getRootType('query')?.name.value).toBe('Query');
		expect([...sorted.types.keys()]).toEqual([
			'Apple',
			'Query',
			'Status',
			'Zebra',
		]);
	});

	it('is settled: sorting twice changes nothing', () => {
		expect(printCatalog(sortCatalog(sortCatalog(shuffled)))).toBe(
			printCatalog(sortCatalog(shuffled))
		);
	});
});

describe('describing a catalog without running anything', () => {
	it('says what the introspection request would have said', async () => {
		const { execute } = await import('../index.js');
		const ran = await execute({
			request: (await import('../index.js')).INTROSPECTION_QUERY,
			catalog,
		});
		const built = await introspectionFromCatalog(catalog);

		expect(JSON.parse(JSON.stringify(built))).toEqual(
			(ran.data as { __schema: unknown }).__schema
		);
	});

	it('rebuilds a catalog from what it wrote', async () => {
		const { buildCatalogFromIntrospection } = await import('../index.js');
		const rebuilt = buildCatalogFromIntrospection({
			__schema: await introspectionFromCatalog(catalog),
		});

		expect(printCatalog(rebuilt)).toBe(printCatalog(catalog));
	});
});

describe('writing a request small', () => {
	it('drops what only helps a reader', () => {
		expect(
			minifyRequest(`
				query Feed($limit: Int = 10) {
					# the newest posts
					posts | sort createdAt desc | page first: $limit {
						title
					}
				}
			`)
		).toBe(
			'query Feed($limit:Int=10){posts|sort createdAt desc|page first:$limit{title}}'
		);
	});

	it('keeps what two names need between them', () => {
		expect(minifyRequest('{ a b c }')).toBe('{a b c}');
		expect(minifyRequest('query A($x: Int) { f(y: $x) }')).toBe(
			'query A($x:Int){f(y:$x)}'
		);
	});

	it('writes something that still means the same thing', () => {
		const source =
			'query A($s: Status = PUBLISHED) { posts(status: $s) { title } }';

		expect(print(parse(minifyRequest(source)))).toBe(print(parse(source)));
	});

	it('keeps a string exactly as it was', () => {
		expect(minifyRequest('{ f(a: "keep  this  space") }')).toBe(
			'{f(a:"keep  this  space")}'
		);
	});
});
