/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { buildCatalog, generateCatalogTypes, generateTypes } from '../index.js';

const catalog = buildCatalog(`
	enum Status { ACTIVE INACTIVE }
	input Filter { status: Status? }
	type Person { id: ID! status: Status! }
	type Robot { id: ID! }
	union Actor = Person | Robot
	type Query {
		person: Person!
		actor: Actor!
		people(filter: Filter?, status: Status?): [Person!]!
	}
	schema { query: Query }
`);

describe('types that survive a server adding something', () => {
	it('leaves room for an enum value a client has not heard of', () => {
		const generated = generateTypes('{ person { status } }', catalog);

		// Known values still complete; a value added later still reads, and an
		// exhaustive switch over it no longer typechecks without a default.
		expect(generated).toMatch(
			/status: 'ACTIVE' \| 'INACTIVE' \| \(string & \{\}\)/
		);
	});

	it('leaves no such room on the way in', () => {
		const generated = generateTypes(
			'query P($status: Status?) { people(status: $status) { id } }',
			catalog
		);

		// A caller must not be able to send a value the server never declared.
		const variables = generated.slice(generated.indexOf('Variables'));
		expect(variables).toMatch(/status\??: 'ACTIVE' \| 'INACTIVE'/);
		expect(variables).not.toMatch(/string & \{\}/);
	});

	it('leaves none inside an input type either', () => {
		const generated = generateTypes(
			'query P($filter: Filter?) { people(filter: $filter) { id } }',
			catalog
		);

		const variables = generated.slice(generated.indexOf('Variables'));
		expect(variables).not.toMatch(/string & \{\}/);
	});

	it('says an answer may be a type the client does not know', () => {
		const generated = generateTypes(
			'{ actor { __typename ... on Person { id } } }',
			catalog
		);

		// A union may gain a member; code matching only what it knows must
		// still have somewhere for the rest to land.
		expect(generated).toMatch(/__typename: \(string & \{\}\);/);
	});

	it('leaves the known branches exactly as they were', () => {
		const generated = generateTypes(
			'{ actor { __typename ... on Person { id } } }',
			catalog
		);

		expect(generated).toMatch(/__typename: 'Person';\s+id: string;/);
	});

	it('writes the catalog as the catalog says it is', () => {
		const generated = generateCatalogTypes(catalog);

		// The catalog types describe the schema as written, and the same name
		// is what input types refer to - opening it there would let a caller
		// send a value the server never declared. Room for what a client has
		// not heard of belongs in what a response may hold, not here.
		expect(generated).toMatch(/export type Status = 'ACTIVE' \| 'INACTIVE';/);
	});
});
