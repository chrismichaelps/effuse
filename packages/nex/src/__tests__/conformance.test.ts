/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * A sweep across the behaviours a client can expect from a hierarchical,
 * strongly typed API: selection, arguments, aliases, fragments, variables,
 * directives, mutation ordering, coercion, error propagation, and paging.
 */

import { describe, expect, it } from 'vitest';
import {
	type Resolvers,
	buildCatalog,
	execute,
	validateRequest,
} from '../index.js';

const catalog = buildCatalog(`
	schema { query: Query mutation: Mutation }

	type Query {
		human(id: ID!): Human
		droid(id: ID!): Droid
		character(id: ID!): Character
		characters: [Character!]! @connection
		numbers: [Int!]!
		ratio: Float!
		flag: Boolean!
		identifier: ID!
		when: DateTime!
		listOfNonNull: [Human!]!
		search(text: String!, limit: Int = 3): [SearchResult!]!
	}

	type Mutation {
		createReview(episode: Episode!, review: ReviewInput!): Review!
		updateName(id: ID!, name: String!): Human!
		deleteHuman(id: ID!): Boolean!
		transaction: Batch!
	}

	type Batch { left: Int! right: Int! }

	interface Character { id: ID! name: String! }
	type Human implements Character { id: ID! name: String! homePlanet: String? height(unit: Unit = METER): Float! }
	type Droid implements Character { id: ID! name: String! primaryFunction: String! }
	type Starship { id: ID! name: String! }
	union SearchResult = Human | Droid | Starship

	type Review { episode: Episode! stars: Int! commentary: String? }
	input ReviewInput { stars: Int! commentary: String }
	enum Episode { NEWHOPE EMPIRE JEDI }
	enum Unit { METER FOOT }
	scalar DateTime
`);

const humans: Record<string, Record<string, unknown>> = {
	'1000': {
		__typename: 'Human',
		id: '1000',
		name: 'Luke',
		homePlanet: 'Tatooine',
		heightMeters: 1.72,
	},
	'1001': {
		__typename: 'Human',
		id: '1001',
		name: 'Vader',
		homePlanet: null,
		heightMeters: 2.02,
	},
};

const order: string[] = [];

const resolvers: Resolvers = {
	Query: {
		human: (_s, args) => humans[String(args.id)],
		droid: () => ({
			__typename: 'Droid',
			id: '2000',
			name: 'R2-D2',
			primaryFunction: 'Astromech',
		}),
		character: (_s, args) => humans[String(args.id)],
		characters: () => Object.values(humans),
		numbers: () => [1, 2, 3],
		ratio: () => 1.5,
		flag: () => true,
		identifier: () => 42,
		when: () => new Date('2026-01-01T00:00:00.000Z'),
		listOfNonNull: () => [humans['1000'], null],
		search: (_s, args) =>
			[
				{ __typename: 'Human', ...humans['1000'] },
				{ __typename: 'Starship', id: '3000', name: 'Falcon' },
			].slice(0, Number(args.limit)),
	},
	Mutation: {
		createReview: (_s, args) => ({
			episode: args.episode,
			...(args.review as Record<string, unknown>),
		}),
		updateName: (_s, args) => ({ ...humans['1000'], name: args.name }),
		deleteHuman: () => true,
		transaction: () => ({}),
	},
	Batch: {
		left: async () => {
			await Promise.resolve();
			order.push('left');
			return 1;
		},
		right: () => {
			order.push('right');
			return 2;
		},
	},
	Human: {
		height: (source, args) => {
			const meters = Number((source as { heightMeters: number }).heightMeters);
			return args.unit === 'FOOT' ? meters * 3.28084 : meters;
		},
	},
};

const run = (request: string, options: Record<string, unknown> = {}) =>
	execute({ request, catalog, resolvers, ...options });

const data = async (request: string, options: Record<string, unknown> = {}) => {
	const result = await run(request, options);
	expect(result.errors).toBeUndefined();
	return result.data;
};

describe('fields and arguments', () => {
	it('walks a selection down to leaf values', async () => {
		expect(await data('{ human(id: "1000") { name homePlanet } }')).toEqual({
			human: { name: 'Luke', homePlanet: 'Tatooine' },
		});
	});

	it('passes arguments that change what a field returns', async () => {
		expect(
			await data('{ human(id: "1000") { height(unit: FOOT) } }')
		).toMatchObject({ human: { height: expect.closeTo(5.64, 2) } });
	});

	it('applies an argument default when the request leaves it out', async () => {
		expect(await data('{ human(id: "1000") { height } }')).toEqual({
			human: { height: 1.72 },
		});
	});

	it('returns null for a nullable field with no value', async () => {
		expect(await data('{ human(id: "1001") { homePlanet } }')).toEqual({
			human: { homePlanet: null },
		});
	});
});

describe('aliases', () => {
	it('asks for the same field twice with different arguments', async () => {
		expect(
			await data(
				'{ luke: human(id: "1000") { name } vader: human(id: "1001") { name } }'
			)
		).toEqual({ luke: { name: 'Luke' }, vader: { name: 'Vader' } });
	});

	it('merges two selections that share a response key', async () => {
		expect(
			await data(
				'{ human(id: "1000") { name } human(id: "1000") { homePlanet } }'
			)
		).toEqual({ human: { name: 'Luke', homePlanet: 'Tatooine' } });
	});
});

describe('fragments', () => {
	it('reuses a fragment across two fields', async () => {
		expect(
			await data(
				'{ a: human(id: "1000") { ...Card } b: human(id: "1001") { ...Card } } fragment Card on Human { name homePlanet }'
			)
		).toEqual({
			a: { name: 'Luke', homePlanet: 'Tatooine' },
			b: { name: 'Vader', homePlanet: null },
		});
	});

	it('passes a variable through a fragment', async () => {
		expect(
			await data(
				'query A($unit: Unit!) { human(id: "1000") { ...H } } fragment H on Human { height(unit: $unit) }',
				{ variables: { unit: 'METER' } }
			)
		).toEqual({ human: { height: 1.72 } });
	});

	it('narrows an abstract type with inline fragments', async () => {
		expect(
			await data(
				'{ search(text: "a") { __typename ... on Human { name } ... on Starship { name } } }'
			)
		).toEqual({
			search: [
				{ __typename: 'Human', name: 'Luke' },
				{ __typename: 'Starship', name: 'Falcon' },
			],
		});
	});

	it('refuses a field that only some members of a union declare', () => {
		expect(
			validateRequest('{ search(text: "a") { name } }', catalog)[0]?.message
		).toMatch(/union type "SearchResult"/);
	});

	it('refuses a field that only an implementation declares', () => {
		expect(
			validateRequest('{ character(id: "1000") { homePlanet } }', catalog)[0]
				?.message
		).toMatch(/Cannot query field "homePlanet" on type "Character"/);
	});
});

describe('variables', () => {
	it('uses a declared default', async () => {
		expect(
			await data('query A($id: ID! = "1000") { human(id: $id) { name } }')
		).toEqual({ human: { name: 'Luke' } });
	});

	it('prefers a supplied value over the default', async () => {
		expect(
			await data('query A($id: ID! = "1000") { human(id: $id) { name } }', {
				variables: { id: '1001' },
			})
		).toEqual({ human: { name: 'Vader' } });
	});

	it('refuses to run when a required variable is missing', async () => {
		const result = await run('query A($id: ID!) { human(id: $id) { name } }');

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/\$id/);
	});

	it('coerces a nested input object', async () => {
		expect(
			await data(
				'mutation M($review: ReviewInput!) { createReview(episode: JEDI, review: $review) { episode stars commentary } }',
				{ variables: { review: { stars: 5, commentary: 'good' } } }
			)
		).toEqual({
			createReview: { episode: 'JEDI', stars: 5, commentary: 'good' },
		});
	});
});

describe('directives', () => {
	it('includes and skips fields', async () => {
		expect(
			await data(
				'query A($show: Boolean!) { human(id: "1000") { name homePlanet @include(if: $show) } }',
				{ variables: { show: false } }
			)
		).toEqual({ human: { name: 'Luke' } });
	});

	it('applies to a fragment spread and an inline fragment', async () => {
		expect(
			await data(
				'query A($no: Boolean!) { human(id: "1000") { name ...H @skip(if: $no) ... on Human @skip(if: $no) { homePlanet } } } fragment H on Human { height }',
				{ variables: { no: true } }
			)
		).toEqual({ human: { name: 'Luke' } });
	});
});

describe('mutations', () => {
	it('creates, updates, and deletes', async () => {
		expect(
			await data(
				'mutation { createReview(episode: JEDI, review: { stars: 5 }) { stars } }'
			)
		).toEqual({ createReview: { stars: 5 } });
		expect(
			await data(
				'mutation { updateName(id: "1000", name: "Skywalker") { name } }'
			)
		).toEqual({ updateName: { name: 'Skywalker' } });
		expect(await data('mutation { deleteHuman(id: "1000") }')).toEqual({
			deleteHuman: true,
		});
	});

	it('runs root fields one after another', async () => {
		order.length = 0;
		await data(
			'mutation { first: transaction { left } second: transaction { right } }'
		);

		expect(order).toEqual(['left', 'right']);
	});

	it('runs the fields inside a transaction one after another', async () => {
		order.length = 0;
		await data('mutation { transaction { left right } }');

		expect(order).toEqual(['left', 'right']);
	});

	it('resolves fields below a mutation root concurrently', async () => {
		const seen: string[] = [];
		const slow = async (label: string, delay: number) => {
			await new Promise((resolve) => setTimeout(resolve, delay));
			seen.push(label);
			return label === 'left' ? 1 : 2;
		};

		await execute({
			request: 'mutation { updateName(id: "1000", name: "x") { id name } }',
			catalog,
			resolvers: {
				Mutation: { updateName: () => ({ id: '1', name: 'x' }) },
				Human: {
					id: () => slow('left', 10).then(String),
					name: () => slow('right', 0).then(() => 'x'),
				},
			},
		});

		expect(seen).toEqual(['right', 'left']);
	});
});

describe('coercion of leaf values', () => {
	it('serializes the built-in scalars', async () => {
		expect(await data('{ ratio flag identifier when numbers }')).toEqual({
			ratio: 1.5,
			flag: true,
			identifier: '42',
			when: '2026-01-01T00:00:00.000Z',
			numbers: [1, 2, 3],
		});
	});

	it('reports a value that cannot be the scalar it declared', async () => {
		const result = await execute({
			request: '{ ratio }',
			catalog,
			resolvers: { Query: { ratio: () => 'not a number' } },
		});

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.message).toMatch(/Float/);
	});

	it('reports a value that is not a member of its enum', async () => {
		const result = await execute({
			request:
				'mutation { createReview(episode: JEDI, review: { stars: 1 }) { episode } }',
			catalog,
			resolvers: {
				Mutation: { createReview: () => ({ episode: 'SEQUEL', stars: 1 }) },
			},
		});

		expect(result.errors?.[0]?.message).toMatch(
			/not a member of enum "Episode"/
		);
	});
});

describe('errors', () => {
	it('nulls a whole non-null list when one item is null', async () => {
		const result = await run('{ listOfNonNull { name } }');

		expect(result.data).toBeNull();
		expect(result.errors?.[0]?.path).toEqual(['listOfNonNull', 1]);
	});

	it('keeps the rest of the response when a nullable field fails', async () => {
		const result = await execute({
			request: '{ human(id: "1000") { name homePlanet } }',
			catalog,
			resolvers: {
				Query: { human: () => humans['1000'] },
				Human: {
					homePlanet: () => {
						throw new Error('planet lookup failed');
					},
				},
			},
		});

		expect(result.data).toEqual({ human: { name: 'Luke', homePlanet: null } });
		expect(result.errors?.[0]?.path).toEqual(['human', 'homePlanet']);
	});

	it('reports a request error before any field runs', async () => {
		let called = false;
		const result = await execute({
			request: '{ human(id: "1000") { nope } }',
			catalog,
			resolvers: {
				Query: {
					human: () => {
						called = true;
						return humans['1000'];
					},
				},
			},
		});

		expect(called).toBe(false);
		expect(result.data).toBeNull();
	});
});

describe('paging a list', () => {
	it('slices without paging', async () => {
		expect(await data('{ numbers | take 2 }')).toEqual({ numbers: [1, 2] });
	});

	it('reports where the list ends', async () => {
		const result = await data('{ characters | page first: 10 { name } }');
		const page = (
			result as { characters: { pageInfo: Record<string, unknown> } }
		).characters;

		expect(page.pageInfo).toMatchObject({ hasNextPage: false });
	});
});
